import { track } from "@/lib/analytics";
import { requireCheckContext, serializeCheck } from "@/lib/checks";
import { sql } from "@/lib/db";
import { handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/checks/:id — E2E_LOCKS §10. */
export const GET = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const profile = await currentProfile();
  const context = await requireCheckContext(id, profile.id);
  return Response.json(serializeCheck(context));
});

/** DELETE /api/checks/:id — soft delete + enqueue purge (PRIVACY retention). */
export const DELETE = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const profile = await currentProfile();
  const context = await requireCheckContext(id, profile.id);

  await sql()`
    UPDATE checks
       SET status = 'deleted', deleted_at = now(), last_activity_at = now()
     WHERE id = ${context.check.id}
  `;

  await sql()`
    INSERT INTO deletion_queue (subject_type, subject_id, reason)
    VALUES ('check', ${context.check.id}, 'user_deleted_check')
  `;

  await track("check_deleted", {
    profileId: profile.id,
    checkId: context.check.id,
    role: context.you.role,
  });

  return Response.json({ deleted: true, checkId: context.check.id });
});
