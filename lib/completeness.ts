import type {
  Answer,
  AnswerCollection,
  CompletenessResult,
  ParticipantAnswer,
} from "../shared/types";

export const PRIMARY_QUESTION_COUNT = 96;
export const FOLLOW_UP_RULES = [
  { parentCode: "CP07", followUpCode: "CP07F", answerMin: 4 },
  { parentCode: "MO04", followUpCode: "MO04F", answerMin: 3 },
] as const;

function toAnswerMap(answers: AnswerCollection): Map<string, Answer> {
  const map = new Map<string, Answer>();
  if (Array.isArray(answers)) {
    for (const item of answers) map.set(item.code, item.answer);
    return map;
  }
  for (const [code, value] of Object.entries(answers)) {
    if (value === undefined) continue;
    const answer =
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      "answer" in value
        ? (value as ParticipantAnswer).answer
        : (value as Answer);
    map.set(code, answer);
  }
  return map;
}

export function requiredFollowUps(answers: AnswerCollection): string[] {
  const map = toAnswerMap(answers);
  return FOLLOW_UP_RULES.filter(
    (rule) => Number(map.get(rule.parentCode)) >= rule.answerMin,
  ).map((rule) => rule.followUpCode);
}

export function calculateRequiredCount(answers: AnswerCollection): number {
  return PRIMARY_QUESTION_COUNT + requiredFollowUps(answers).length;
}

/**
 * Calculate participant completeness from distinct saved responses.
 * Unknown codes are ignored when a primary-code allowlist is supplied.
 */
export function calculateCompleteness(
  answers: AnswerCollection,
  primaryCodes?: Iterable<string>,
): CompletenessResult {
  const map = toAnswerMap(answers);
  const requiredFollowUpCodes = requiredFollowUps(answers);
  const pending = requiredFollowUpCodes.filter((code) => !map.has(code));

  const primarySet = primaryCodes
    ? new Set(primaryCodes)
    : new Set(
        [...map.keys()].filter(
          (code) => !FOLLOW_UP_RULES.some((rule) => rule.followUpCode === code),
        ),
      );
  const primaryAnswered = [...primarySet].filter((code) => map.has(code)).length;
  const followUpsAnswered = requiredFollowUpCodes.filter((code) =>
    map.has(code),
  ).length;
  const answerCount = primaryAnswered + followUpsAnswered;
  const requiredCount = PRIMARY_QUESTION_COUNT + requiredFollowUpCodes.length;

  return {
    requiredCount,
    answerCount,
    complete: answerCount === requiredCount && pending.length === 0,
    followUpsPending: pending,
  };
}

export function progressPercent(answerCount: number, requiredCount: number): number {
  if (requiredCount <= 0) return 0;
  return Math.floor((100 * answerCount) / requiredCount);
}

export const getCompleteness = calculateCompleteness;
