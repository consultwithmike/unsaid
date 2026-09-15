/**
 * Unsaid scoring — docs/SCORING.md (algorithm_version 1.0.0).
 *
 * TODO(slice C): owned by the scoring slice. The exports here are what the API
 * slice consumes; keep the signatures stable when replacing the internals.
 *
 * Pure functions only: no I/O, no DB, no env.
 */

import type {
  ParticipantAnswer as BankParticipantAnswer,
  ScoredQuestion,
  ScoringInput,
  ScoringQuestion as BankQuestion,
  ScoringResult,
} from "./types";

export const ALGORITHM_VERSION = "1.0.0";
export const QUESTION_SET_VERSION = "2026.09";

export type ResponseType = "AG5" | "YN3" | "ORD" | "CAT" | "MULTI";

export type Classification =
  | "aligned"
  | "slight"
  | "conversation"
  | "major"
  | "major_conversation";

export type AlignmentBand =
  | "mostly_aligned"
  | "some_important_differences"
  | "several_important_differences"
  | "major_differences";

export interface ScoringQuestion {
  code: string;
  sectionId: string;
  responseType: ResponseType;
  /** Ordered option values as they appear in the bank. */
  optionValues?: Array<string | number>;
  compatibilityMatrix?: Record<string, Record<string, number>> | null;
  distanceMode?: string | null;
  specialScoring?: string | null;
}

export interface ParticipantAnswer {
  answer: unknown;
  importance: number;
  hardLine: boolean;
}

export interface ScoredItem {
  code: string;
  sectionId: string;
  distance: number;
  weight: number;
  impact: number;
  classification: Classification;
  hardLineCollision: boolean;
}

export interface CategoryScore {
  sectionId: string;
  label: string;
  alignmentIndex: number;
}

export interface ClassificationCounts {
  aligned: number;
  slight: number;
  conversation: number;
  major: number;
  major_conversation: number;
}

export interface ScoredCheck {
  algorithmVersion: string;
  alignmentIndex: number;
  alignmentBand: AlignmentBand;
  counts: ClassificationCounts;
  hardLineCollisionCount: number;
  /** count(conversation) + count(major) + count(major_conversation) — E2E_LOCKS §8 */
  teaserConversationCount: number;
  items: ScoredItem[];
}

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

function indexOfOption(
  optionValues: Array<string | number> | undefined,
  answer: unknown,
): number {
  if (!optionValues) return -1;
  return optionValues.findIndex((value) => String(value) === String(answer));
}

function ordDistance(
  optionValues: Array<string | number> | undefined,
  a: unknown,
  b: unknown,
): number {
  const size = optionValues?.length ?? 0;
  if (size < 2) return 0;
  const ia = indexOfOption(optionValues, a);
  const ib = indexOfOption(optionValues, b);
  if (ia < 0 || ib < 0) return String(a) === String(b) ? 0 : 1;
  return Math.abs(ia - ib) / (size - 1);
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}

function jaccardDistance(a: unknown, b: unknown): number {
  const setA = new Set(toArray(a));
  const setB = new Set(toArray(b));
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const value of setA) if (setB.has(value)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return 1 - intersection / union;
}

function matrixDistance(
  matrix: Record<string, Record<string, number>> | null | undefined,
  a: unknown,
  b: unknown,
): number {
  const row = matrix?.[String(a)];
  const value = row?.[String(b)];
  if (typeof value === "number") return value;
  const mirrored = matrix?.[String(b)]?.[String(a)];
  if (typeof mirrored === "number") return mirrored;
  return String(a) === String(b) ? 0 : 1;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function distanceFor(
  question: ScoringQuestion,
  a: ParticipantAnswer,
  b: ParticipantAnswer,
): number {
  const mode = question.distanceMode ?? question.responseType.toLowerCase();

  // Locked special: CP02 "I genuinely don't care".
  if (
    question.specialScoring === "cp02_dont_care" ||
    mode === "ord_cp02_dont_care"
  ) {
    const normal = ordDistance(question.optionValues, a.answer, b.answer);
    const aDontCare = String(a.answer) === "dont_care";
    const bDontCare = String(b.answer) === "dont_care";
    if (aDontCare && bDontCare) return 0;
    const softened =
      (aDontCare && a.importance <= 3) || (bDontCare && b.importance <= 3);
    return clamp01(softened ? Math.min(normal, 0.25) : normal);
  }

  // Locked special: MO02 CAT treated as an ordered continuum.
  if (question.specialScoring === "mo02_ordered" || mode === "ord_as_cat") {
    return clamp01(ordDistance(question.optionValues, a.answer, b.answer));
  }

  if (question.specialScoring === "hl02_matrix" || mode === "cat_matrix") {
    return clamp01(matrixDistance(question.compatibilityMatrix, a.answer, b.answer));
  }

  switch (question.responseType) {
    case "AG5":
      return clamp01(Math.abs(Number(a.answer) - Number(b.answer)) / 4);
    case "YN3":
      return clamp01(Math.abs(Number(a.answer) - Number(b.answer)) / 2);
    case "MULTI":
      return clamp01(jaccardDistance(a.answer, b.answer));
    case "ORD":
      return clamp01(ordDistance(question.optionValues, a.answer, b.answer));
    case "CAT":
      if (question.compatibilityMatrix) {
        return clamp01(
          matrixDistance(question.compatibilityMatrix, a.answer, b.answer),
        );
      }
      return String(a.answer) === String(b.answer) ? 0 : 1;
    default:
      return String(a.answer) === String(b.answer) ? 0 : 1;
  }
}

// ---------------------------------------------------------------------------
// Classification / weighting
// ---------------------------------------------------------------------------

export function isHardLineCollision(
  distance: number,
  a: ParticipantAnswer,
  b: ParticipantAnswer,
): boolean {
  return distance >= 0.75 && (a.hardLine || b.hardLine);
}

export function classify(distance: number, collision: boolean): Classification {
  if (collision) return "major_conversation";
  if (distance < 0.25) return "aligned";
  if (distance < 0.5) return "slight";
  if (distance < 0.75) return "conversation";
  return "major";
}

export function weightFor(a: ParticipantAnswer, b: ParticipantAnswer): number {
  return Math.sqrt(a.importance * b.importance);
}

export function scoreItem(
  question: ScoringQuestion,
  a: ParticipantAnswer,
  b: ParticipantAnswer,
): ScoredItem {
  const distance = distanceFor(question, a, b);
  const collision = isHardLineCollision(distance, a, b);
  const weight = weightFor(a, b);
  return {
    code: question.code,
    sectionId: question.sectionId,
    distance,
    weight,
    impact: distance * weight * (collision ? 2 : 1),
    classification: classify(distance, collision),
    hardLineCollision: collision,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export function alignmentIndexOf(
  items: Array<Pick<ScoredItem, "distance" | "weight">>,
): number {
  let weighted = 0;
  let total = 0;
  for (const item of items) {
    weighted += item.distance * item.weight;
    total += item.weight;
  }
  if (total === 0) return 100;
  return Math.round(100 * (1 - weighted / total));
}

export function alignmentBandOf(alignmentIndex: number): AlignmentBand {
  if (alignmentIndex >= 85) return "mostly_aligned";
  if (alignmentIndex >= 70) return "some_important_differences";
  if (alignmentIndex >= 55) return "several_important_differences";
  return "major_differences";
}

export const ALIGNMENT_BAND_LABELS: Record<AlignmentBand, string> = {
  mostly_aligned: "Mostly aligned",
  some_important_differences: "Some important differences",
  several_important_differences: "Several important differences",
  major_differences: "Major differences worth understanding",
};

export interface ScoreCheckInput {
  question: ScoringQuestion;
  a: ParticipantAnswer;
  b: ParticipantAnswer;
}

export function scoreCheck(
  inputs: ScoreCheckInput[],
  sectionLabels: Record<string, string> = {},
): ScoredCheck & { categoryScores: CategoryScore[] } {
  const items = inputs.map(({ question, a, b }) => scoreItem(question, a, b));

  const counts: ClassificationCounts = {
    aligned: 0,
    slight: 0,
    conversation: 0,
    major: 0,
    major_conversation: 0,
  };
  let hardLineCollisionCount = 0;
  for (const item of items) {
    counts[item.classification] += 1;
    if (item.hardLineCollision) hardLineCollisionCount += 1;
  }

  const alignmentIndex = alignmentIndexOf(items);

  const bySection = new Map<string, ScoredItem[]>();
  for (const item of items) {
    const bucket = bySection.get(item.sectionId);
    if (bucket) bucket.push(item);
    else bySection.set(item.sectionId, [item]);
  }

  const categoryScores: CategoryScore[] = [...bySection.entries()]
    .map(([sectionId, sectionItems]) => ({
      sectionId,
      label: sectionLabels[sectionId] ?? sectionId,
      alignmentIndex: alignmentIndexOf(sectionItems),
    }))
    // Weakest sections first — results UI shows "Alignment by topic".
    .sort((left, right) => left.alignmentIndex - right.alignmentIndex);

  return {
    algorithmVersion: ALGORITHM_VERSION,
    alignmentIndex,
    alignmentBand: alignmentBandOf(alignmentIndex),
    counts,
    hardLineCollisionCount,
    teaserConversationCount:
      counts.conversation + counts.major + counts.major_conversation,
    items: items.slice().sort((left, right) => right.impact - left.impact),
    categoryScores,
  };
}

/** DB/scoring labels → API `counts` keys (E2E_LOCKS §8). */
export function toApiCounts(
  counts: ClassificationCounts,
  hardLineCollisions: number,
): {
  aligned: number;
  minor: number;
  conversation: number;
  major: number;
  hardLineCollisions: number;
} {
  return {
    aligned: counts.aligned,
    minor: counts.slight,
    conversation: counts.conversation,
    major: counts.major + counts.major_conversation,
    hardLineCollisions,
  };
}

// ---------------------------------------------------------------------------
// Bank-native API
// ---------------------------------------------------------------------------

function fromBankQuestion(question: BankQuestion): ScoringQuestion {
  const responseType = question.responseType ?? question.type;
  if (!responseType) {
    throw new TypeError(`Question ${question.code} has no response type`);
  }
  return {
    code: question.code,
    sectionId: question.section ?? "",
    responseType,
    optionValues: question.responseOptions?.map((option) => option.value),
    compatibilityMatrix: question.compatibilityMatrix,
    distanceMode: question.distanceMode ?? question.special ?? null,
    specialScoring: question.specialScoring ?? question.special ?? null,
  };
}

function fromBankAnswer(answer: BankParticipantAnswer): ParticipantAnswer {
  return {
    answer: answer.answer,
    importance: answer.importance,
    hardLine: Boolean(answer.hardLine),
  };
}

export function calculateDistance(
  question: BankQuestion,
  a: BankParticipantAnswer,
  b: BankParticipantAnswer,
): number {
  return distanceFor(
    fromBankQuestion(question),
    fromBankAnswer(a),
    fromBankAnswer(b),
  );
}

export function classifyDistance(
  distance: number,
  hardLineCollision = false,
): Classification {
  return classify(distance, hardLineCollision);
}

export function scoreQuestion(input: ScoringInput): ScoredQuestion {
  if (
    !Number.isInteger(input.a.importance) ||
    input.a.importance < 1 ||
    input.a.importance > 5 ||
    !Number.isInteger(input.b.importance) ||
    input.b.importance < 1 ||
    input.b.importance > 5
  ) {
    throw new RangeError("Importance must be an integer from 1 to 5");
  }
  const distance = calculateDistance(input, input.a, input.b);
  const weight = Math.sqrt(input.a.importance * input.b.importance);
  const hardLineCollision =
    distance >= 0.75 && Boolean(input.a.hardLine || input.b.hardLine);
  return {
    code: input.code,
    section: input.section,
    distance,
    weight,
    questionScore: 100 * (1 - distance),
    impact: distance * weight * (hardLineCollision ? 2 : 1),
    classification: classify(distance, hardLineCollision),
    hardLineCollision,
  };
}

function includeFollowUp(
  input: ScoringInput,
  byCode: Map<string, ScoringInput>,
): boolean {
  const condition =
    input.hiddenUnlessParent ??
    (input.code === "CP07F"
      ? { code: "CP07", answerMin: 4 }
      : input.code === "MO04F"
        ? { code: "MO04", answerMin: 3 }
        : undefined);
  if (!condition) return true;
  const parent = byCode.get(condition.code);
  if (!parent) return true;
  const minimum = condition.answerMin ?? 0;
  return (
    Number(parent.a.answer) >= minimum &&
    Number(parent.b.answer) >= minimum
  );
}

function indexFor(items: ScoredQuestion[]): number {
  return alignmentIndexOf(items);
}

export function calculateScores(inputs: ScoringInput[]): ScoringResult {
  const byCode = new Map(inputs.map((input) => [input.code, input]));
  const items = inputs
    .filter((input) => includeFollowUp(input, byCode))
    .map(scoreQuestion);
  const categoryScores: Record<string, number> = {};
  const sections = new Set(
    items.map((item) => item.section).filter((value): value is string => Boolean(value)),
  );
  for (const section of sections) {
    categoryScores[section] = indexFor(
      items.filter((item) => item.section === section),
    );
  }
  const counts = {
    aligned: items.filter((item) => item.classification === "aligned").length,
    minor: items.filter((item) => item.classification === "slight").length,
    conversation: items.filter((item) => item.classification === "conversation")
      .length,
    major: items.filter(
      (item) =>
        item.classification === "major" ||
        item.classification === "major_conversation",
    ).length,
    hardLineCollisions: items.filter((item) => item.hardLineCollision).length,
  };
  return {
    algorithmVersion: "1.0.0",
    alignmentIndex: indexFor(items),
    categoryScores,
    counts,
    conversationCount: counts.conversation + counts.major,
    items,
  };
}

export const scoreAssessment = calculateScores;
export const calculateAlignment = calculateScores;
