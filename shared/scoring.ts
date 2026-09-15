import type {
  Answer,
  Classification,
  ParticipantAnswer,
  ScoredQuestion,
  ScoringInput,
  ScoringQuestion,
  ScoringResult,
} from "./types";

export const ALGORITHM_VERSION = "1.0.0" as const;

function assertImportance(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new RangeError("Importance must be an integer from 1 to 5");
  }
}

function optionIndex(question: ScoringQuestion, answer: Answer): number {
  const index = question.responseOptions?.findIndex(
    (option) => option.value === answer,
  );
  if (index === undefined || index < 0) {
    throw new RangeError(`Unknown answer for ${question.code}: ${String(answer)}`);
  }
  return index;
}

function orderedDistance(
  question: ScoringQuestion,
  answerA: Answer,
  answerB: Answer,
): number {
  const count = question.responseOptions?.length ?? 0;
  if (count < 2) {
    throw new RangeError(`${question.code} needs at least two ordered options`);
  }
  return Math.abs(
    optionIndex(question, answerA) - optionIndex(question, answerB),
  ) / (count - 1);
}

function multiDistance(answerA: Answer, answerB: Answer): number {
  if (!Array.isArray(answerA) || !Array.isArray(answerB)) {
    throw new TypeError("MULTI answers must be arrays");
  }
  const a = new Set(answerA);
  const b = new Set(answerB);
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return 1 - intersection / union.size;
}

function matrixDistance(
  question: ScoringQuestion,
  answerA: Answer,
  answerB: Answer,
): number {
  if (Array.isArray(answerA) || Array.isArray(answerB)) {
    throw new TypeError("Matrix answers must be scalar values");
  }
  const a = String(answerA);
  const b = String(answerB);
  const distance =
    question.compatibilityMatrix?.[a]?.[b] ??
    question.compatibilityMatrix?.[b]?.[a];
  if (distance === undefined || distance < 0 || distance > 1) {
    throw new RangeError(`Missing compatibility matrix value for ${a}/${b}`);
  }
  return distance;
}

/** Calculate algorithm 1.0.0 distance for one question. */
export function calculateDistance(
  question: ScoringQuestion,
  a: ParticipantAnswer,
  b: ParticipantAnswer,
): number {
  assertImportance(a.importance);
  assertImportance(b.importance);
  const type = question.responseType ?? question.type;
  const mode = question.distanceMode ?? question.special ?? question.specialScoring;

  if (question.specialScoring === "mo02_ordered" || mode === "ord_as_cat") {
    return orderedDistance(question, a.answer, b.answer);
  }
  if (
    question.specialScoring === "hl02_matrix" ||
    mode === "hl02_matrix" ||
    mode === "cat_matrix" ||
    (type === "CAT" && question.compatibilityMatrix)
  ) {
    return matrixDistance(question, a.answer, b.answer);
  }
  if (mode === "ord_cp02_dont_care" || mode === "cp02_dont_care") {
    if (a.answer === "dont_care" && b.answer === "dont_care") return 0;
    const normal = orderedDistance(question, a.answer, b.answer);
    const lowImportanceDontCare =
      (a.answer === "dont_care" && a.importance <= 3) ||
      (b.answer === "dont_care" && b.importance <= 3);
    return lowImportanceDontCare ? Math.min(normal, 0.25) : normal;
  }

  switch (type) {
    case "AG5":
      return Math.abs(Number(a.answer) - Number(b.answer)) / 4;
    case "YN3":
      return Math.abs(Number(a.answer) - Number(b.answer)) / 2;
    case "ORD":
      return orderedDistance(question, a.answer, b.answer);
    case "CAT":
      return matrixDistance(question, a.answer, b.answer);
    case "MULTI":
      return multiDistance(a.answer, b.answer);
    default:
      throw new TypeError(`Unsupported distance mode for ${question.code}`);
  }
}

export function classifyDistance(
  distance: number,
  hardLineCollision = false,
): Classification {
  if (hardLineCollision) return "major_conversation";
  if (distance < 0.25) return "aligned";
  if (distance < 0.5) return "slight";
  if (distance < 0.75) return "conversation";
  return "major";
}

export function scoreQuestion(input: ScoringInput): ScoredQuestion {
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
    classification: classifyDistance(distance, hardLineCollision),
    hardLineCollision,
    impact: distance * weight * (hardLineCollision ? 2 : 1),
  };
}

function parentAllowsFollowUp(
  input: ScoringInput,
  byCode: Map<string, ScoringInput>,
): boolean {
  const condition = input.hiddenUnlessParent;
  const known =
    condition ??
    (input.code === "CP07F"
      ? { code: "CP07", answerMin: 4 }
      : input.code === "MO04F"
        ? { code: "MO04", answerMin: 3 }
        : undefined);
  if (!known) return true;
  const parent = byCode.get(known.code);
  // A standalone follow-up can still be scored (useful for deterministic tests).
  if (!parent) return true;
  const minimum = known.answerMin ?? 0;
  return Number(parent.a.answer) >= minimum && Number(parent.b.answer) >= minimum;
}

function weightedIndex(items: ScoredQuestion[]): number {
  const weight = items.reduce((sum, item) => sum + item.weight, 0);
  if (weight === 0) return 100;
  const weightedDistance = items.reduce(
    (sum, item) => sum + item.distance * item.weight,
    0,
  );
  return Math.round(100 * (1 - weightedDistance / weight));
}

/** Score a complete pair of assessments, excluding inapplicable follow-ups. */
export function calculateScores(inputs: ScoringInput[]): ScoringResult {
  const byCode = new Map(inputs.map((input) => [input.code, input]));
  const included = inputs.filter((input) => parentAllowsFollowUp(input, byCode));
  const items = included.map(scoreQuestion);
  const categoryScores: Record<string, number> = {};
  for (const section of new Set(items.map((item) => item.section).filter(Boolean))) {
    categoryScores[section!] = weightedIndex(
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
    algorithmVersion: ALGORITHM_VERSION,
    alignmentIndex: weightedIndex(items),
    categoryScores,
    counts,
    conversationCount: counts.conversation + counts.major,
    items,
  };
}

export const scoreAssessment = calculateScores;
export const calculateAlignment = calculateScores;
