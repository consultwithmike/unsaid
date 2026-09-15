import { describe, expect, it } from "vitest";
import { buildQuestionWalk } from "../lib/question-bank";

describe("buildQuestionWalk follow-up insertion", () => {
  it("inserts CP07F when CP07 answer is 4", () => {
    const walk = buildQuestionWalk({ CP07: 4 });
    expect(walk.map((q) => q.code)).toContain("CP07F");
  });

  it("does not insert CP07F when CP07 answer is 3", () => {
    const walk = buildQuestionWalk({ CP07: 3 });
    expect(walk.map((q) => q.code)).not.toContain("CP07F");
  });

  it("inserts MO04F when MO04 answer is 3", () => {
    const walk = buildQuestionWalk({ MO04: 3 });
    expect(walk.map((q) => q.code)).toContain("MO04F");
  });

  it("does not insert MO04F when MO04 answer is 2", () => {
    const walk = buildQuestionWalk({ MO04: 2 });
    expect(walk.map((q) => q.code)).not.toContain("MO04F");
  });

  it("places follow-ups immediately after their parent", () => {
    const walk = buildQuestionWalk({ CP07: 5, MO04: 4 });
    const cp07Idx = walk.findIndex((q) => q.code === "CP07");
    const cp07fIdx = walk.findIndex((q) => q.code === "CP07F");
    expect(cp07fIdx).toBe(cp07Idx + 1);

    const mo04Idx = walk.findIndex((q) => q.code === "MO04");
    const mo04fIdx = walk.findIndex((q) => q.code === "MO04F");
    expect(mo04fIdx).toBe(mo04Idx + 1);
  });
});
