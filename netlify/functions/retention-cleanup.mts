import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

/**
 * Daily retention job (PRIVACY "Retention (MVP)").
 *
 * 1. Expire unfinished checks after 90 days of inactivity.
 * 2. Expire invitations whose TTL has elapsed.
 * 3. Purge encrypted answers for queued deletions.
 *
 * Payment rows are retained: only accounting-required fields survive, and
 * those live on `payments`, which this job does not touch.
 */

const INACTIVITY_DAYS = 90;

export default async function handler() {
  const db = getDatabase();
  const startedAt = Date.now();

  const expiredByInactivity = await db.sql<{ id: string }>`
    UPDATE checks
       SET status = 'expired'
     WHERE status IN ('awaiting_partner', 'active')
       AND last_activity_at < now() - make_interval(days => ${INACTIVITY_DAYS})
    RETURNING id
  `;

  const expiredInvites = await db.sql<{ id: string }>`
    UPDATE invitations
       SET invalidated_at = now()
     WHERE accepted_at IS NULL
       AND invalidated_at IS NULL
       AND expires_at < now()
    RETURNING id
  `;

  const pending = await db.sql<{
    id: string;
    subject_type: string;
    subject_id: string;
  }>`
    SELECT id, subject_type, subject_id
      FROM deletion_queue
     WHERE processed_at IS NULL
       AND purge_after <= now()
     LIMIT 500
  `;

  let purgedChecks = 0;
  let purgedProfiles = 0;

  for (const entry of pending) {
    if (entry.subject_type === "check") {
      await db.sql`DELETE FROM responses WHERE check_id = ${entry.subject_id}`;
      await db.sql`
        UPDATE checks SET encrypted_dek = NULL WHERE id = ${entry.subject_id}
      `;
      purgedChecks += 1;
    } else if (entry.subject_type === "profile" || entry.subject_type === "clerk_user") {
      const profiles =
        entry.subject_type === "profile"
          ? await db.sql<{ id: string }>`
              SELECT id FROM profiles WHERE id = ${entry.subject_id}
            `
          : await db.sql<{ id: string }>`
              SELECT id FROM profiles WHERE clerk_user_id = ${entry.subject_id}
            `;

      for (const profile of profiles) {
        await db.sql`
          DELETE FROM responses
           WHERE participant_id IN (
             SELECT id FROM check_participants WHERE profile_id = ${profile.id}
           )
        `;
        await db.sql`
          UPDATE profiles
             SET email = concat('deleted+', id::text, '@unsaid.invalid'),
                 first_name = '',
                 preferred_name = NULL,
                 pronouns = NULL,
                 updated_at = now()
           WHERE id = ${profile.id}
        `;
        purgedProfiles += 1;
      }
    }

    await db.sql`
      UPDATE deletion_queue SET processed_at = now() WHERE id = ${entry.id}
    `;
  }

  const summary = {
    expiredByInactivity: expiredByInactivity.length,
    expiredInvites: expiredInvites.length,
    purgedChecks,
    purgedProfiles,
    durationMs: Date.now() - startedAt,
  };
  console.log("[retention-cleanup]", summary);

  return new Response(JSON.stringify(summary), {
    headers: { "content-type": "application/json" },
  });
}

export const config: Config = {
  schedule: "@daily",
};
