import { readFileSync } from "node:fs";

function load(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const bank = load("content/questions/2026.09.json");
const primary = bank.questions.filter((q) => !q.parentCode);
const followUps = bank.questions.filter((q) => q.parentCode);
if (primary.length !== 96) {
  throw new Error(`expected 96 primary questions, got ${primary.length}`);
}
if (bank.sections?.length !== 12) {
  throw new Error(`expected 12 sections, got ${bank.sections?.length}`);
}
const followCodes = followUps.map((q) => q.code).sort();
if (followCodes.join() !== "CP07F,MO04F") {
  throw new Error(`unexpected follow-ups: ${followCodes.join(",")}`);
}

const golden = load("content/fixtures/scoring-golden.json");
if (!golden.cases?.length) {
  throw new Error("scoring-golden.json has no cases");
}

console.log(
  `OK: ${primary.length} primaries, ${followUps.length} follow-ups, ${golden.cases.length} golden cases`,
);
