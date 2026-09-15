import bank from "@/content/questions/2026.09.json";

import { QUESTION_SET_VERSION } from "./env";
import { sql } from "./db";
import type { ResponseType, ScoringQuestion } from "@/shared/scoring";

export interface QuestionOption {
  value: string | number;
  label: string;
}

export interface QuestionRow {
  id: string;
  code: string;
  question_set_version: string;
  section_id: string;
  prompt: string;
  response_type: ResponseType;
  options: QuestionOption[] | null;
  compatibility_matrix: Record<string, Record<string, number>> | null;
  parent_code: string | null;
  show_when: { code?: string; answerMin?: number | null; importanceMin?: number | null } | null;
  distance_mode: string | null;
  special_scoring: string | null;
  display_order: string | number;
  active: boolean;
  conversation_prompts: string[] | null;
  neutral_description: string | null;
  tone_note: string | null;
}

export interface FollowUpRule {
  parentCode: string;
  followUpCode: string;
  answerMin: number;
}

interface Bank {
  questionSetVersion: string;
  sections: Array<{ id: string; title: string; intro: string; durationHint: string }>;
  questions: Array<{
    code: string;
    section: string;
    displayOrder: number;
    followUpWhen?: { answerMin?: number | null; followUpCode?: string } | null;
    parentCode?: string | null;
  }>;
}

const typedBank = bank as unknown as Bank;

export function sectionLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const section of typedBank.sections) labels[section.id] = section.title;
  return labels;
}

export function sectionOrder(): string[] {
  return typedBank.sections.map((section) => section.id);
}

/**
 * Parent → follow-up trigger rules. Derived from the bank so adding a
 * follow-up to the JSON does not need a code change.
 */
export function followUpRules(): FollowUpRule[] {
  const rules: FollowUpRule[] = [];
  for (const question of typedBank.questions) {
    const trigger = question.followUpWhen;
    if (trigger?.followUpCode && typeof trigger.answerMin === "number") {
      rules.push({
        parentCode: question.code,
        followUpCode: trigger.followUpCode,
        answerMin: trigger.answerMin,
      });
    }
  }
  return rules;
}

export function followUpCodes(): Set<string> {
  return new Set(followUpRules().map((rule) => rule.followUpCode));
}

const cache = new Map<string, QuestionRow[]>();

/** Full active bank for a question set version, in section + display order. */
export async function loadQuestions(
  version: string = QUESTION_SET_VERSION,
): Promise<QuestionRow[]> {
  const cached = cache.get(version);
  if (cached) return cached;

  const order = sectionOrder();
  const rows = await sql()<QuestionRow>`
    SELECT id, code, question_set_version, section_id, prompt, response_type,
           options, compatibility_matrix, parent_code, show_when, distance_mode,
           special_scoring, display_order, active, conversation_prompts,
           neutral_description, tone_note
      FROM questions
     WHERE question_set_version = ${version}
       AND active = true
  `;

  const sectionRank = new Map(order.map((id, index) => [id, index]));
  const sorted = rows.slice().sort((left, right) => {
    const leftRank = sectionRank.get(left.section_id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = sectionRank.get(right.section_id) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return Number(left.display_order) - Number(right.display_order);
  });

  cache.set(version, sorted);
  return sorted;
}

export function optionValues(row: QuestionRow): Array<string | number> | undefined {
  if (!row.options) return undefined;
  return row.options.map((option) => option.value);
}

export function toScoringQuestion(row: QuestionRow): ScoringQuestion {
  return {
    code: row.code,
    sectionId: row.section_id,
    responseType: row.response_type,
    optionValues: optionValues(row),
    compatibilityMatrix: row.compatibility_matrix,
    distanceMode: row.distance_mode,
    specialScoring: row.special_scoring,
  };
}

/** Validates a submitted answer against the bank definition for that question. */
export function isValidAnswer(row: QuestionRow, answer: unknown): boolean {
  const allowed = optionValues(row);
  if (row.response_type === "MULTI") {
    if (!Array.isArray(answer) || answer.length === 0) return false;
    if (!allowed) return true;
    const allowedSet = new Set(allowed.map(String));
    return answer.every((value) => allowedSet.has(String(value)));
  }
  if (Array.isArray(answer)) return false;
  if (answer === null || answer === undefined || answer === "") return false;
  if (!allowed) return true;
  return allowed.some((value) => String(value) === String(answer));
}
