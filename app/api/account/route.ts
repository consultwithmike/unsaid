import { track } from "@/lib/analytics";
import { sql } from "@/lib/db";
import { handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/account — soft-delete the profile, soft-delete its checks and
 * enqueue the purge. Row-level destruction happens in the retention job so
 * accounting-required payment fields survive (PRIVACY retention table).
 */
export const DELETE = handler(async () => {
  const profile = await currentProfile();

  const checks = await sql()<{ id: string }>`
    UPDATE checks
       SET status = 'deleted', deleted_at = now(), last_activity_at = now()
     WHERE id IN (
       SELECT check_id FROM check_participants WHERE profile_id = ${profile.id}
     )
       AND deleted_at IS NULL
    RETURNING id
  `;

  for (const check of checks) {
    await sql()`
      INSERT INTO deletion_queue (subject_type, subject_id, reason)
      VALUES ('check', ${check.id}, 'account_deleted')
    `;
  }

  await sql()`
    UPDATE profiles
       SET deleted_at = now(), updated_at = now()
     WHERE id = ${profile.id}
  `;

  await sql()`
    INSERT INTO deletion_queue (subject_type, subject_id, reason)
    VALUES ('profile', ${profile.id}, 'account_deleted')
  `;

  await track("account_deleted", { profileId: profile.id });

  return Response.json({ deleted: true, checksDeleted: checks.length });
});
