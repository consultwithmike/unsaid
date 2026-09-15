import {
  checkDek,
  isUnlocked,
  isUuid,
  requireCheckContext,
} from "@/lib/checks";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";
import { loadOwnAnswers } from "@/lib/responses";
import { findResultItem, orderParticipants, serializeResultItem } from "@/lib/results";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ checkId: string; questionId: string }> };

/**
 * GET /api/results/:checkId/items/:questionId
 *
 * Metadata + prompts + revealStatus by default. `?include=own` adds the
 * caller's own answer. The partner's answer is returned only when
 * `revealStatus === "mutual"` (PRIVACY invariants 1–2, 9).
 */
export const GET = handler(async (request: Request, { params }: Params) => {
  const { checkId, questionId } = await params;
  if (!isUuid(questionId)) apiError("NOT_FOUND");

  const profile = await currentProfile();
  const { check, you, participants } = await requireCheckContext(checkId, profile.id);

  if (!isUnlocked(check)) apiError("PAYMENT_REQUIRED");

  const item = await findResultItem(check.id, questionId);
  if (!item) apiError("NOT_FOUND");

  const payload: Record<string, unknown> = serializeResultItem(item);
  const include = new URL(request.url).searchParams.get("include");
  const wantsOwn = include?.split(",").includes("own") ?? false;
  const mutual = (item.reveal_status ?? "none") === "mutual";

  if (wantsOwn || mutual) {
    const dek = checkDek(check);
    const ownAnswers = await loadOwnAnswers(you, check, dek);
    const own = ownAnswers.find((answer) => answer.questionId === questionId);

    if (wantsOwn) {
      payload.ownAnswer = own
        ? {
            answer: own.answer,
            importance: own.importance,
            hardLine: own.hardLine,
          }
        : null;
    }

    if (mutual) {
      const [a, b] = orderParticipants(participants);
      const partner = you.id === a.id ? b : a;
      const partnerAnswers = await loadOwnAnswers(partner, check, dek);
      const partnerAnswer = partnerAnswers.find(
        (answer) => answer.questionId === questionId,
      );
      payload.partnerAnswer = partnerAnswer
        ? {
            answer: partnerAnswer.answer,
            // Importance is shared on mutual reveal; hard-line authorship is
            // never disclosed (PRIVACY invariant 8).
            importance: partnerAnswer.importance,
          }
        : null;
    }
  }

  return Response.json(payload);
});
