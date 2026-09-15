import { track } from "@/lib/analytics";
import { isUnlocked, isUuid, requireCheckContext } from "@/lib/checks";
import { sql } from "@/lib/db";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ checkId: string; questionId: string }> };

/** POST /api/results/:checkId/items/:questionId/discussed */
export const POST = handler(async (request: Request, { params }: Params) => {
  const { checkId, questionId } = await params;
  if (!isUuid(questionId)) apiError("NOT_FOUND");

  const profile = await currentProfile();
  const { check, you } = await requireCheckContext(checkId, profile.id);
  if (!isUnlocked(check)) apiError("PAYMENT_REQUIRED");

  const body = (await request.json().catch(() => ({}))) as { discussed?: boolean };
  const discussed = body.discussed ?? true;

  const rows = await sql()<{ discussed_at: string | null }>`
    UPDATE result_items
       SET discussed_at = ${discussed ? new Date().toISOString() : null}
     WHERE check_id = ${check.id} AND question_id = ${questionId}
    RETURNING discussed_at
  `;
  if (rows.length === 0) apiError("NOT_FOUND");

  await track("conversation_opened", {
    profileId: profile.id,
    checkId: check.id,
    role: you.role,
  });

  return Response.json({ questionId, discussedAt: rows[0].discussed_at });
});
