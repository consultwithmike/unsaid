import { describe, expect, it } from "vitest";
import fixture from "../content/fixtures/scoring-golden.json";
import bank from "../content/questions/2026.09.json";
import {
  calculateDistance,
  calculateScores,
  scoreQuestion,
} from "../shared/scoring";
import type { ScoringInput, ScoringQuestion } from "../shared/types";

const questions = new Map(
  bank.questions.map((question) => [question.code, question as ScoringQuestion]),
);

function inputFor(raw: (typeof fixture.cases)[number]["questions"][number]): ScoringInput {
  return {
    ...(questions.get(raw.code) ?? {}),
    ...raw,
    responseType: raw.type as ScoringInput["responseType"],
    a: raw.a as ScoringInput["a"],
    b: raw.b as ScoringInput["b"],
  };
}

describe("scoring golden fixture", () => {
  for (const testCase of fixture.cases) {
    it(testCase.id, () => {
      const inputs = testCase.questions.map(inputFor);
      const result = calculateScores(inputs);
      const scored = inputs.length === 1 ? scoreQuestion(inputs[0]) : undefined;
      const expected = testCase.expect as Record<string, unknown>;

      if (expected.distance !== undefined) {
        expect(scored!.distance).toBeCloseTo(
          Number(expected.distance),
          expected.tolerance ? 2 : 8,
        );
      }
      if (expected.distanceMax !== undefined) {
        expect(scored!.distance).toBeLessThanOrEqual(Number(expected.distanceMax));
      }
      if (expected.distanceMin !== undefined) {
        expect(scored!.distance).toBeGreaterThanOrEqual(Number(expected.distanceMin));
      }
      if (expected.impact !== undefined) {
        expect(scored!.impact).toBeCloseTo(Number(expected.impact), 8);
      }
      if (expected.classification !== undefined) {
        expect(scored!.classification).toBe(expected.classification);
      }
      if (expected.hardLineCollision !== undefined) {
        expect(scored!.hardLineCollision).toBe(expected.hardLineCollision);
      }
      if (expected.alignmentIndex !== undefined) {
        expect(result.alignmentIndex).toBe(expected.alignmentIndex);
      }
    });
  }
});

describe("locked distance modes and aggregation", () => {
  it("uses MO02 option order and the HL02 matrix", () => {
    const mo02 = questions.get("MO02")!;
    const hl02 = questions.get("HL02")!;
    expect(
      calculateDistance(
        mo02,
        { answer: "fully_combined", importance: 3 },
        { answer: "fully_separate", importance: 3 },
      ),
    ).toBe(1);
    expect(
      calculateDistance(
        hl02,
        { answer: "major_city", importance: 3 },
        { answer: "rural", importance: 3 },
      ),
    ).toBe(0.75);
  });

  it("excludes a follow-up unless both parents trigger it", () => {
    const parent = questions.get("CP07")!;
    const followUp = questions.get("CP07F")!;
    const result = calculateScores([
      {
        ...parent,
        a: { answer: 3, importance: 3 },
        b: { answer: 5, importance: 3 },
      },
      {
        ...followUp,
        a: { answer: ["public"], importance: 3 },
        b: { answer: ["private"], importance: 3 },
      },
    ]);
    expect(result.items.map((item) => item.code)).toEqual(["CP07"]);
  });

  it("maps API counts and does not double-count collisions in teaser count", () => {
    const result = calculateScores([
      {
        code: "collision",
        responseType: "AG5",
        a: { answer: 1, importance: 5, hardLine: true },
        b: { answer: 5, importance: 5 },
      },
    ]);
    expect(result.counts).toMatchObject({ major: 1, hardLineCollisions: 1 });
    expect(result.conversationCount).toBe(1);
  });
});
