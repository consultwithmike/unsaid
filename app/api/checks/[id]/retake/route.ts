import { track } from "@/lib/analytics";
import {
  inviteUrlFor,
  issueInvitation,
  requireCheckContext,
  type CheckRow,
} from "@/lib/checks";
import { generateDek, wrapDek } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { QUESTION_SET_VERSION } from "@/lib/env";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/checks/:id/retake — creates a brand-new check. The original is
 * untouched so historical results stay reproducible.
 */
export const POST = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const profile = await currentProfile();
  const { check, you, partner } = await requireCheckContext(id, profile.id);

  if (check.status !== "ready" && check.status !== "unlocked") {
    apiError("CHECK_STATE", "You can only retake a finished check.");
  }

  const partnerFirstName =
    partner?.first_name_snapshot ?? check.partner_first_name_pending ?? "your partner";

  const [created] = await sql()<CheckRow>`
    INSERT INTO checks (
      status, question_set_version, relationship_stage, wedding_date,
      partner_first_name_pending, created_by_profile_id, encrypted_dek
    ) VALUES (
      'awaiting_partner', ${QUESTION_SET_VERSION}, ${check.relationship_stage},
      ${check.wedding_date}, ${partnerFirstName}, ${profile.id},
      ${wrapDek(generateDek())}
    )
    RETURNING id, status, question_set_version, relationship_stage, wedding_date,
              partner_first_name_pending, created_by_profile_id, created_at,
              expires_at, unlocked_at, payment_status, algorithm_version,
              encrypted_dek, last_activity_at, deleted_at
  `;

  await sql()`
    INSERT INTO check_participants
      (check_id, profile_id, role, first_name_snapshot)
    VALUES (${created.id}, ${profile.id}, 'A', ${you.first_name_snapshot})
  `;

  const { token, invitation } = await issueInvitation(created.id, partnerFirstName);

  await track("retake_started", {
    profileId: profile.id,
    checkId: created.id,
    role: "A",
  });

  return Response.json(
    {
      checkId: created.id,
      previousCheckId: check.id,
      status: "awaiting_partner",
      inviteToken: token,
      inviteUrl: inviteUrlFor(token),
      inviteExpiresAt: new Date(invitation.expires_at).toISOString(),
    },
    { status: 201 },
  );
});
