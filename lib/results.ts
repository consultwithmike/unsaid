import { sql, withTransaction } from "./db";
import { apiError } from "./errors";
import { ALGORITHM_VERSION, CURRENCY, PRICE_CENTS } from "./env";
import {
  checkDek,
  isUnlocked,
  listParticipants,
  type CheckRow,
  type ParticipantRow,
} from "./checks";
import { loadOwnAnswers } from "./responses";
import { loadQuestions, sectionLabels, toScoringQuestion } from "./questions";
import {
  alignmentBandOf,
  scoreCheck,
  toApiCounts,
  type CategoryScore,
  type Classification,
  type ParticipantAnswer,
  type ScoreCheckInput,
} from "@/shared/scoring";

export interface ResultsRow {
  check_id: string;
  algorithm_version: string;
  question_set_version: string;
  alignment_index: string | number;
  aligned_count: number;
  minor_count: number;
  conversation_count: number;
  major_count: number;
  hard_line_collision_count: number;
  teaser_conversation_count: number;
  category_scores: CategoryScore[] | null;
  generated_at: string;
}

export async function findResults(checkId: string): Promise<ResultsRow | null> {
  const rows = await sql()<ResultsRow>`
    SELECT check_id, algorithm_version, question_set_version, alignment_index,
           aligned_count, minor_count, conversation_count, major_count,
           hard_line_collision_count, teaser_conversation_count, category_scores,
           generated_at
      FROM results
     WHERE check_id = ${checkId}
  `;
  return rows[0] ?? null;
}

/**
 * Idempotent calculate (API_CONTRACT §9, FLOWS §5): lock the check row, insert
 * `results` with ON CONFLICT DO NOTHING, and only write items/category scores
 * when this call is the one that inserted.
 */
export async function calculateResults(check: CheckRow): Promise<ResultsRow> {
  const existing = await findResults(check.id);
  if (existing) return existing;

  const participants = await listParticipants(check.id);
  if (participants.length < 2) apiError("CHECK_STATE", "Your partner has not joined yet.");
  const incomplete = participants.some((row) => !row.completed_at);
  if (incomplete) apiError("CHECK_STATE", "You both need to finish first.");

  const [a, b] = orderParticipants(participants);
  const dek = checkDek(check);
  const [answersA, answersB] = await Promise.all([
    loadOwnAnswers(a, check, dek),
    loadOwnAnswers(b, check, dek),
  ]);

  const questions = await loadQuestions(check.question_set_version);
  const labels = sectionLabels();
  const byCodeA = new Map(answersA.map((answer) => [answer.code, answer]));
  const byCodeB = new Map(answersB.map((answer) => [answer.code, answer]));

  const inputs: ScoreCheckInput[] = [];
  const questionIdByCode = new Map<string, string>();
  for (const question of questions) {
    const left = byCodeA.get(question.code);
    const right = byCodeB.get(question.code);
    // Follow-ups only score when both sides triggered and answered them
    // (SCORING.md "Follow-ups", FLOWS §3).
    if (!left || !right) continue;
    questionIdByCode.set(question.code, question.id);
    inputs.push({
      question: toScoringQuestion(question),
      a: toParticipantAnswer(left),
      b: toParticipantAnswer(right),
    });
  }

  if (inputs.length === 0) {
    apiError("CHECK_STATE", "There are no comparable answers yet.");
  }

  const scored = scoreCheck(inputs, labels);
  const counts = scored.counts;

  return withTransaction(async (client) => {
    await client.query("SELECT id FROM checks WHERE id = $1 FOR UPDATE", [check.id]);

    const inserted = await client.query<{ check_id: string }>(
      `INSERT INTO results (
         check_id, algorithm_version, question_set_version, alignment_index,
         aligned_count, minor_count, conversation_count, major_count,
         hard_line_collision_count, teaser_conversation_count, category_scores
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (check_id) DO NOTHING
       RETURNING check_id`,
      [
        check.id,
        ALGORITHM_VERSION,
        check.question_set_version,
        scored.alignmentIndex,
        counts.aligned,
        counts.slight,
        counts.conversation,
        counts.major + counts.major_conversation,
        scored.hardLineCollisionCount,
        scored.teaserConversationCount,
        JSON.stringify(scored.categoryScores),
      ],
    );

    if (inserted.rows.length > 0) {
      let rank = 0;
      for (const item of scored.items) {
        const questionId = questionIdByCode.get(item.code);
        if (!questionId) continue;
        rank += 1;
        await client.query(
          `INSERT INTO result_items (
             check_id, question_id, distance, impact, classification,
             hard_line_collision, category, sort_rank
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (check_id, question_id) DO NOTHING`,
          [
            check.id,
            questionId,
            item.distance,
            item.impact,
            item.classification,
            item.hardLineCollision,
            labels[item.sectionId] ?? item.sectionId,
            rank,
          ],
        );
      }

      await client.query(
        `UPDATE checks
            SET status = CASE WHEN status IN ('awaiting_partner','active') THEN 'ready' ELSE status END,
                algorithm_version = $2,
                last_activity_at = now()
          WHERE id = $1`,
        [check.id, ALGORITHM_VERSION],
      );
    }

    const rows = await client.query<ResultsRow>(
      `SELECT check_id, algorithm_version, question_set_version, alignment_index,
              aligned_count, minor_count, conversation_count, major_count,
              hard_line_collision_count, teaser_conversation_count,
              category_scores, generated_at
         FROM results WHERE check_id = $1`,
      [check.id],
    );
    return rows.rows[0]!;
  });
}

function toParticipantAnswer(answer: {
  answer: unknown;
  importance: number;
  hardLine: boolean;
}): ParticipantAnswer {
  return {
    answer: answer.answer,
    importance: answer.importance,
    hardLine: answer.hardLine,
  };
}

export function orderParticipants(
  participants: ParticipantRow[],
): [ParticipantRow, ParticipantRow] {
  const a = participants.find((row) => row.role === "A");
  const b = participants.find((row) => row.role === "B");
  if (!a || !b) apiError("CHECK_STATE", "Your partner has not joined yet.");
  return [a, b];
}

// ---------------------------------------------------------------------------
// Result items + reveals
// ---------------------------------------------------------------------------

export interface ResultItemRow {
  check_id: string;
  question_id: string;
  distance: string | number;
  impact: string | number;
  classification: Classification;
  hard_line_collision: boolean;
  category: string;
  discussed_at: string | null;
  sort_rank: number;
  code: string;
  prompt: string;
  neutral_description: string | null;
  conversation_prompts: string[] | null;
  reveal_status: "none" | "requested_by_a" | "requested_by_b" | "mutual" | null;
}

export async function listResultItems(checkId: string): Promise<ResultItemRow[]> {
  return sql()<ResultItemRow>`
    SELECT ri.check_id, ri.question_id, ri.distance, ri.impact, ri.classification,
           ri.hard_line_collision, ri.category, ri.discussed_at, ri.sort_rank,
           q.code, q.prompt, q.neutral_description, q.conversation_prompts,
           rv.status AS reveal_status
      FROM result_items ri
      JOIN questions q ON q.id = ri.question_id
      LEFT JOIN reveals rv
        ON rv.check_id = ri.check_id AND rv.question_id = ri.question_id
     WHERE ri.check_id = ${checkId}
     ORDER BY ri.impact DESC
  `;
}

export async function findResultItem(
  checkId: string,
  questionId: string,
): Promise<ResultItemRow | null> {
  const rows = await sql()<ResultItemRow>`
    SELECT ri.check_id, ri.question_id, ri.distance, ri.impact, ri.classification,
           ri.hard_line_collision, ri.category, ri.discussed_at, ri.sort_rank,
           q.code, q.prompt, q.neutral_description, q.conversation_prompts,
           rv.status AS reveal_status
      FROM result_items ri
      JOIN questions q ON q.id = ri.question_id
      LEFT JOIN reveals rv
        ON rv.check_id = ri.check_id AND rv.question_id = ri.question_id
     WHERE ri.check_id = ${checkId} AND ri.question_id = ${questionId}
  `;
  return rows[0] ?? null;
}

export function serializeResultItem(row: ResultItemRow) {
  return {
    questionId: row.question_id,
    code: row.code,
    category: row.category,
    title: row.prompt,
    classification: row.classification,
    hardLineCollision: row.hard_line_collision,
    impact: Number(row.impact),
    distance: Number(row.distance),
    neutralDescription: row.neutral_description,
    prompts: row.conversation_prompts ?? [],
    discussedAt: row.discussed_at,
    revealStatus: row.reveal_status ?? "none",
  };
}

// ---------------------------------------------------------------------------
// Results payloads (API_CONTRACT §4)
// ---------------------------------------------------------------------------

export function participantNames(participants: ParticipantRow[], check: CheckRow) {
  const a = participants.find((row) => row.role === "A");
  const b = participants.find((row) => row.role === "B");
  return {
    a: a?.first_name_snapshot ?? null,
    b: b?.first_name_snapshot ?? check.partner_first_name_pending ?? null,
  };
}

export async function resultsPayload(
  check: CheckRow,
  participants: ParticipantRow[],
): Promise<Record<string, unknown>> {
  const results = await findResults(check.id);
  const names = participantNames(participants, check);

  if (!results) {
    return {
      status: check.status,
      locked: true,
      names,
      conversationCount: null,
      hardLineCollisionCount: null,
      alignmentIndex: null,
      counts: null,
      categoryScores: null,
      items: null,
      priceCents: PRICE_CENTS,
      currency: CURRENCY,
    };
  }

  if (!isUnlocked(check)) {
    return {
      status: check.payment_status === "refunded" ? "ready" : check.status,
      locked: true,
      names,
      conversationCount: results.teaser_conversation_count,
      hardLineCollisionCount: results.hard_line_collision_count,
      alignmentIndex: null,
      counts: null,
      categoryScores: null,
      items: null,
      priceCents: PRICE_CENTS,
      currency: CURRENCY,
    };
  }

  const items = await listResultItems(check.id);
  const alignmentIndex = Math.round(Number(results.alignment_index));

  return {
    status: "unlocked",
    locked: false,
    names,
    alignmentIndex,
    alignmentBand: alignmentBandOf(alignmentIndex),
    counts: toApiCounts(
      {
        aligned: results.aligned_count,
        slight: results.minor_count,
        conversation: results.conversation_count,
        // major_count already merges major + major_conversation.
        major: results.major_count,
        major_conversation: 0,
      },
      results.hard_line_collision_count,
    ),
    conversationCount: results.teaser_conversation_count,
    hardLineCollisionCount: results.hard_line_collision_count,
    categoryScores: results.category_scores ?? [],
    items: items.map(serializeResultItem),
    priceCents: PRICE_CENTS,
    currency: CURRENCY,
  };
}
