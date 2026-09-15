import bank from "@/content/questions/2026.09.json";

/**
 * Static, synchronous read of the local question bank JSON — used only for
 * client-side assessment rendering (question text/options/prompts). This is
 * distinct from `lib/questions.ts`, which is the server-only DB-backed loader
 * used by API routes; that file is owned by the API slice and must not be
 * edited here.
 */

export type ResponseType = "AG5" | "ORD" | "CAT" | "MULTI";

export interface QuestionOption {
  value: string | number;
  label: string;
}

export interface QuestionBankEntry {
  code: string;
  section: string;
  displayOrder: number;
  text: string;
  responseType: ResponseType;
  responseOptions: QuestionOption[];
  neutralDescription?: string;
  prompts?: string[];
  parentCode: string | null;
  followUpWhen: {
    followUpCode: string;
    answerMin?: number;
    answerMax?: number;
  } | null;
  hiddenUnlessParent?: { code: string; answerMin?: number; answerMax?: number } | null;
  compatibilityMatrix: unknown;
  distanceMode?: string;
}

export interface QuestionSection {
  id: string;
  title: string;
  intro: string;
  durationHint: string;
}

interface QuestionBank {
  questionSetVersion: string;
  sections: QuestionSection[];
  questions: QuestionBankEntry[];
}

const typedBank = bank as unknown as QuestionBank;

export const questionSetVersion = typedBank.questionSetVersion;

export function getSections(): QuestionSection[] {
  return typedBank.sections;
}

export function getSectionById(id: string): QuestionSection | undefined {
  return typedBank.sections.find((s) => s.id === id);
}

/** Primary (non-follow-up) questions in canonical display order. */
export function getPrimaryQuestions(): QuestionBankEntry[] {
  return typedBank.questions
    .filter((q) => !q.parentCode)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getFollowUpFor(code: string): QuestionBankEntry | undefined {
  const parent = getQuestionByCode(code);
  if (parent?.followUpWhen?.followUpCode) {
    const byCode = getQuestionByCode(parent.followUpWhen.followUpCode);
    if (byCode) return byCode;
  }
  return typedBank.questions.find((q) => q.parentCode === code);
}

export function getQuestionByCode(code: string): QuestionBankEntry | undefined {
  return typedBank.questions.find((q) => q.code === code);
}

export function getQuestionsBySection(sectionId: string): QuestionBankEntry[] {
  return typedBank.questions
    .filter((q) => q.section === sectionId && !q.parentCode)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Base (no follow-up) required count — E2E_LOCKS §4. */
export const BASE_REQUIRED_COUNT = getPrimaryQuestions().length;

/**
 * Whether a follow-up question is triggered given the parent's saved answer.
 * Mirrors E2E_LOCKS §4 (`CP07` >= 4, `MO04` >= 3) generically via `followUpWhen`.
 */
export function isFollowUpTriggered(
  followUp: QuestionBankEntry,
  parentAnswer: number | string | string[] | undefined,
): boolean {
  if (!followUp.followUpWhen) return false;
  if (typeof parentAnswer !== "number") return false;
  const { answerMin, answerMax } = followUp.followUpWhen as {
    answerMin?: number;
    answerMax?: number;
  };
  if (answerMin !== undefined && parentAnswer < answerMin) return false;
  if (answerMax !== undefined && parentAnswer > answerMax) return false;
  return true;
}

/**
 * Builds the full ordered walk of question codes for the assessment,
 * inserting a triggered follow-up immediately after its parent.
 */
export function buildQuestionWalk(
  answersByCode: Record<string, number | string | string[] | undefined>,
): QuestionBankEntry[] {
  const walk: QuestionBankEntry[] = [];
  for (const q of getPrimaryQuestions()) {
    walk.push(q);
    const followUp = getFollowUpFor(q.code);
    if (followUp && isFollowUpTriggered(followUp, answersByCode[q.code])) {
      walk.push(followUp);
    }
  }
  return walk;
}

export const SECTION_QUESTION_COUNT = 8;
