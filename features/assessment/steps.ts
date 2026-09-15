import {
  buildQuestionWalk,
  getSections,
  type QuestionBankEntry,
} from "@/lib/question-bank";

export type AnswerValue = number | string | string[];

export interface AnswerState {
  answer: AnswerValue;
  importance: number;
  hardLine: boolean;
}

export type Step =
  | { kind: "intro"; sectionId: string }
  | {
      kind: "question";
      sectionId: string;
      question: QuestionBankEntry;
      indexInSection: number;
      sectionSize: number;
    }
  | { kind: "sectionComplete"; sectionId: string; nextSectionId: string | null };

export function buildSteps(answers: Record<string, AnswerState>): Step[] {
  const answersByCode: Record<string, AnswerValue | undefined> = {};
  for (const [code, s] of Object.entries(answers)) answersByCode[code] = s.answer;

  const walk = buildQuestionWalk(answersByCode);
  const sections = getSections();
  const steps: Step[] = [];

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];
    const questionsInSection = walk.filter((q) => q.section === section.id);
    const primaryCount = questionsInSection.filter((q) => !q.parentCode).length;

    steps.push({ kind: "intro", sectionId: section.id });

    let primarySeen = 0;
    for (const q of questionsInSection) {
      if (!q.parentCode) primarySeen += 1;
      steps.push({
        kind: "question",
        sectionId: section.id,
        question: q,
        indexInSection: primarySeen,
        sectionSize: primaryCount,
      });
    }

    steps.push({
      kind: "sectionComplete",
      sectionId: section.id,
      nextSectionId: sections[sIdx + 1]?.id ?? null,
    });
  }

  return steps;
}

export function findStepIndexForCode(steps: Step[], code: string | null): number {
  if (!code) return 0;
  const idx = steps.findIndex((s) => s.kind === "question" && s.question.code === code);
  return idx === -1 ? 0 : idx;
}
