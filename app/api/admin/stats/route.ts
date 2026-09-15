import { sql } from "@/lib/db";
import { isAdminEmail } from "@/lib/env";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats — aggregate counts only. Admins can never read answers
 * (PRIVACY invariant 6). Non-admins get 404, not 403 (FLOWS §8).
 */
export const GET = handler(async () => {
  const profile = await currentProfile();
  if (!isAdminEmail(profile.email)) apiError("NOT_FOUND");

  const [checks] = await sql()<{
    total: number;
    awaiting_partner: number;
    active: number;
    ready: number;
    unlocked: number;
    expired: number;
  }>`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status = 'awaiting_partner')::int AS awaiting_partner,
           count(*) FILTER (WHERE status = 'active')::int AS active,
           count(*) FILTER (WHERE status = 'ready')::int AS ready,
           count(*) FILTER (WHERE status = 'unlocked')::int AS unlocked,
           count(*) FILTER (WHERE status = 'expired')::int AS expired
      FROM checks
     WHERE deleted_at IS NULL
  `;

  const [profiles] = await sql()<{ total: number; complete: number }>`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE age_confirmed_18 AND first_name <> '')::int AS complete
      FROM profiles
     WHERE deleted_at IS NULL
  `;

  const [payments] = await sql()<{
    paid: number;
    refunded: number;
    gross_cents: number;
  }>`
    SELECT count(*) FILTER (WHERE status = 'paid')::int AS paid,
           count(*) FILTER (WHERE status = 'refunded')::int AS refunded,
           COALESCE(sum(amount) FILTER (WHERE status = 'paid'), 0)::int AS gross_cents
      FROM payments
  `;

  return Response.json({ checks, profiles, payments });
});
