import { sql } from "./db";
import { apiError } from "./errors";
import { decryptAnswer, encryptAnswer } from "./crypto";
import {
  followUpRules,
  isValidAnswer,
  loadQuestions,
  sectionOrder,
  type QuestionRow,
} from "./questions";
import type { CheckRow, ParticipantRow } from "./checks";

export interface ResponseRow {
  id: string;
  question_id: string;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  auth_tag: Uint8Array;
  importance: number;
  hard_line: boolean;
}

export interface OwnAnswer {
  questionId: string;
  code: string;
  answer: unknown;
  importance: number;
  hardLine: boolean;
}

export interface ProgressState {
  answerCount: number;
  requiredCount: number;
  followUpsRequired: string[];
  followUpsPending: string[];
  answeredCodes: Set<string>;
}

function primaryCodes(questions: QuestionRow[]): string[] {
  return questions.filter((row) => !row.parent_code).map((row) => row.code);
}

/**
 * Follow-up codes this participant's answers trigger, derived from the
 * plaintext parent answer at write time. Stored on `check_participants` so
 * progress reads never decrypt anything (E2E_LOCKS §4).
 */
function triggeredFollowUp(
  parentCode: string,
  answer: unknown,
): { followUpCode: string; required: boolean } | null {
  const rule = followUpRules().find((entry) => entry.parentCode === parentCode);
  if (!rule) return null;
  const numeric = Number(answer);
  return {
    followUpCode: rule.followUpCode,
    required: Number.isFinite(numeric) && numeric >= rule.answerMin,
  };
}

async function answeredCodesFor(
  participantId: string,
): Promise<Set<string>> {
  const rows = await sql()<{ code: string }>`
    SELECT q.code
      FROM responses r
      JOIN questions q ON q.id = r.question_id
     WHERE r.participant_id = ${participantId}
  `;
  return new Set(rows.map((row) => row.code));
}

/**
 * Recomputes and persists `answer_count` / `required_count` /
 * `follow_ups_required` for one participant.
 */
export async function recomputeProgress(
  participant: ParticipantRow,
  check: CheckRow,
  followUpsRequired: string[],
): Promise<ProgressState> {
  const questions = await loadQuestions(check.question_set_version);
  const primaries = primaryCodes(questions);
  const requiredSet = new Set([...primaries, ...followUpsRequired]);

  const answered = await answeredCodesFor(participant.id);
  const answeredRequired = [...answered].filter((code) => requiredSet.has(code));
  const requiredCount = requiredSet.size;
  const answerCount = answeredRequired.length;
  const followUpsPending = followUpsRequired.filter((code) => !answered.has(code));

  await sql()`
    UPDATE check_participants
       SET answer_count = ${answerCount},
           required_count = ${requiredCount},
           follow_ups_required = ${followUpsRequired}
     WHERE id = ${participant.id}
  `;

  return {
    answerCount,
    requiredCount,
    followUpsRequired,
    followUpsPending,
    answeredCodes: answered,
  };
}

export async function progressFor(
  participant: ParticipantRow,
  check: CheckRow,
): Promise<ProgressState> {
  return recomputeProgress(
    participant,
    check,
    participant.follow_ups_required ?? [],
  );
}

export interface SaveResponseInput {
  check: CheckRow;
  participant: ParticipantRow;
  dek: Buffer;
  questionCode: string;
  answer: unknown;
  importance: number;
  hardLine: boolean;
}

export async function saveResponse(
  input: SaveResponseInput,
): Promise<{ progress: ProgressState; question: QuestionRow }> {
  const { check, participant, dek } = input;
  const questions = await loadQuestions(check.question_set_version);
  const question = questions.find((row) => row.code === input.questionCode);
  if (!question) apiError("VALIDATION", "Unknown question code.");

  if (!Number.isInteger(input.importance) || input.importance < 1 || input.importance > 5) {
    apiError("VALIDATION", "Importance must be an integer from 1 to 5.");
  }
  if (!isValidAnswer(question, input.answer)) {
    apiError("VALIDATION", "That answer is not one of the available options.");
  }
  // Hard line is only offered at importance >= 4.
  const hardLine = input.importance >= 4 ? Boolean(input.hardLine) : false;

  // A follow-up may only be answered while its parent still triggers it.
  if (question.parent_code) {
    const required = participant.follow_ups_required ?? [];
    if (!required.includes(question.code)) {
      apiError("VALIDATION", "That follow-up does not apply to your answers.");
    }
  }

  const sealed = encryptAnswer(dek, input.answer);
  await sql()`
    INSERT INTO responses
      (check_id, participant_id, question_id, ciphertext, iv, auth_tag, importance, hard_line)
    VALUES (
      ${check.id}, ${participant.id}, ${question.id},
      ${sealed.ciphertext}, ${sealed.iv}, ${sealed.authTag},
      ${input.importance}, ${hardLine}
    )
    ON CONFLICT (participant_id, question_id) DO UPDATE
      SET ciphertext = EXCLUDED.ciphertext,
          iv = EXCLUDED.iv,
          auth_tag = EXCLUDED.auth_tag,
          importance = EXCLUDED.importance,
          hard_line = EXCLUDED.hard_line,
          updated_at = now()
  `;

  let followUpsRequired = [...(participant.follow_ups_required ?? [])];
  const trigger = triggeredFollowUp(question.code, input.answer);
  if (trigger) {
    const has = followUpsRequired.includes(trigger.followUpCode);
    if (trigger.required && !has) followUpsRequired.push(trigger.followUpCode);
    if (!trigger.required && has) {
      followUpsRequired = followUpsRequired.filter(
        (code) => code !== trigger.followUpCode,
      );
      // The stale follow-up answer no longer applies to anything.
      const stale = questions.find((row) => row.code === trigger.followUpCode);
      if (stale) {
        await sql()`
          DELETE FROM responses
           WHERE participant_id = ${participant.id}
             AND question_id = ${stale.id}
        `;
      }
    }
  }

  const progress = await recomputeProgress(participant, check, followUpsRequired);
  return { progress, question };
}

export async function loadOwnAnswers(
  participant: ParticipantRow,
  check: CheckRow,
  dek: Buffer,
): Promise<OwnAnswer[]> {
  const questions = await loadQuestions(check.question_set_version);
  const byId = new Map(questions.map((row) => [row.id, row]));

  const rows = await sql()<ResponseRow>`
    SELECT id, question_id, ciphertext, iv, auth_tag, importance, hard_line
      FROM responses
     WHERE participant_id = ${participant.id}
  `;

  const answers: OwnAnswer[] = [];
  for (const row of rows) {
    const question = byId.get(row.question_id);
    if (!question) continue;
    answers.push({
      questionId: row.question_id,
      code: question.code,
      answer: decryptAnswer(dek, {
        ciphertext: Buffer.from(row.ciphertext),
        iv: Buffer.from(row.iv),
        authTag: Buffer.from(row.auth_tag),
      }),
      importance: row.importance,
      hardLine: row.hard_line,
    });
  }
  return answers;
}

export interface ResumeCursor {
  currentSectionId: string | null;
  currentQuestionCode: string | null;
  sectionProgress: { index: number; answeredInSection: number; sectionSize: number } | null;
}

/**
 * Walks the bank in order and returns the first unanswered required question
 * (FLOWS §4). A triggered follow-up comes immediately after its parent.
 */
export async function resumeCursor(
  check: CheckRow,
  progress: ProgressState,
): Promise<ResumeCursor> {
  const questions = await loadQuestions(check.question_set_version);
  const requiredFollowUps = new Set(progress.followUpsRequired);
  const ordered = questions.filter(
    (row) => !row.parent_code || requiredFollowUps.has(row.code),
  );

  const next = ordered.find((row) => !progress.answeredCodes.has(row.code));
  if (!next) {
    return { currentSectionId: null, currentQuestionCode: null, sectionProgress: null };
  }

  const sectionIds = sectionOrder();
  const sectionQuestions = ordered.filter((row) => row.section_id === next.section_id);
  const answeredInSection = sectionQuestions.filter((row) =>
    progress.answeredCodes.has(row.code),
  ).length;

  return {
    currentSectionId: next.section_id,
    currentQuestionCode: next.code,
    sectionProgress: {
      index: Math.max(0, sectionIds.indexOf(next.section_id)),
      answeredInSection,
      sectionSize: sectionQuestions.length,
    },
  };
}
