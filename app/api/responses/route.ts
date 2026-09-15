import { z } from "zod";

import {
  checkDek,
  requireCheckContext,
  touchCheck,
  type CheckRow,
  type ParticipantRow,
} from "@/lib/checks";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";
import {
  loadOwnAnswers,
  progressFor,
  resumeCursor,
  saveResponse,
} from "@/lib/responses";

export const dynamic = "force-dynamic";

function assertWritable(check: CheckRow): void {
  if (check.status === "expired") apiError("CHECK_STATE", "This check has expired.");
  if (check.status === "deleted") apiError("NOT_FOUND");
  if (check.status === "ready" || check.status === "unlocked") {
    apiError("CHECK_STATE", "Your comparison has already been created.");
  }
}

async function ownState(check: CheckRow, participant: ParticipantRow) {
  const progress = await progressFor(participant, check);
  const cursor = await resumeCursor(check, progress);
  return { progress, cursor };
}

/** GET /api/responses?checkId= — own answers and resume cursor (API_CONTRACT §5). */
export const GET = handler(async (request: Request) => {
  const checkId = new URL(request.url).searchParams.get("checkId");
  if (!checkId) apiError("VALIDATION", "checkId is required.");

  const profile = await currentProfile();
  const { check, you } = await requireCheckContext(checkId, profile.id);

  const { progress, cursor } = await ownState(check, you);
  const answers = await loadOwnAnswers(you, check, checkDek(check));

  return Response.json({
    participantId: you.id,
    answerCount: progress.answerCount,
    requiredCount: progress.requiredCount,
    followUpsPending: progress.followUpsPending,
    currentSectionId: cursor.currentSectionId,
    currentQuestionCode: cursor.currentQuestionCode,
    sectionProgress: cursor.sectionProgress,
    completed: Boolean(you.completed_at),
    answers: answers.map((answer) => ({
      questionId: answer.questionId,
      code: answer.code,
      answer: answer.answer,
      importance: answer.importance,
      hardLine: answer.hardLine,
    })),
  });
});

const upsertSchema = z.object({
  checkId: z.string().uuid(),
  questionCode: z.string().trim().min(2).max(16),
  answer: z.union([
    z.number(),
    z.string(),
    z.array(z.union([z.string(), z.number()])),
  ]),
  importance: z.number().int().min(1).max(5),
  hardLine: z.boolean().optional(),
});

/** POST /api/responses — one question per request (API_CONTRACT §6). */
export const POST = handler(async (request: Request) => {
  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    apiError("VALIDATION", parsed.error.issues[0]?.message ?? undefined);
  }
  const body = parsed.data;

  const profile = await currentProfile();
  const { check, you } = await requireCheckContext(body.checkId, profile.id);
  assertWritable(check);

  const { progress } = await saveResponse({
    check,
    participant: you,
    dek: checkDek(check),
    questionCode: body.questionCode,
    answer: body.answer,
    importance: body.importance,
    hardLine: body.hardLine ?? false,
  });

  await touchCheck(check.id);
  const cursor = await resumeCursor(check, progress);

  return Response.json({
    saved: true,
    answerCount: progress.answerCount,
    requiredCount: progress.requiredCount,
    followUpsPending: progress.followUpsPending,
    currentSectionId: cursor.currentSectionId,
    currentQuestionCode: cursor.currentQuestionCode,
    sectionProgress: cursor.sectionProgress,
  });
});
