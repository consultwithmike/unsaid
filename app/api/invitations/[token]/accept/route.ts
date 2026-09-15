import { track } from "@/lib/analytics";
import {
  assertInvitationUsable,
  findCheck,
  findInvitationByToken,
  listParticipants,
  serializeCheck,
} from "@/lib/checks";
import { sql } from "@/lib/db";
import { apiError, handler } from "@/lib/errors";
import { requireCompleteProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/** POST /api/invitations/:token/accept — FLOWS §1, E2E_LOCKS §3. */
export const POST = handler(async (_request: Request, { params }: Params) => {
  const { token } = await params;
  const profile = await requireCompleteProfile();

  const invitation = await findInvitationByToken(token);
  if (!invitation) apiError("NOT_FOUND", "That invitation link is not valid.");

  const check = await findCheck(invitation.check_id);
  if (!check || check.deleted_at || check.status === "deleted") apiError("NOT_FOUND");
  if (check.status === "expired") apiError("INVITE_EXPIRED");

  // Self-join is forbidden (PRIVACY invariant 10).
  if (check.created_by_profile_id === profile.id) apiError("SELF_JOIN");

  const participants = await listParticipants(check.id);
  const already = participants.find((row) => row.profile_id === profile.id);
  if (already) {
    return Response.json({
      checkId: check.id,
      role: already.role,
      alreadyJoined: true,
      check: serializeCheck({
        check,
        you: already,
        partner: participants.find((row) => row.id !== already.id) ?? null,
        participants,
      }),
    });
  }

  assertInvitationUsable(invitation);
  if (invitation.accepted_at) apiError("CONFLICT", "That invitation has already been used.");
  if (participants.length >= 2) {
    apiError("CONFLICT", "This check already has two participants.");
  }

  const [participant] = await sql()<{ id: string; role: "A" | "B" }>`
    INSERT INTO check_participants
      (check_id, profile_id, role, first_name_snapshot)
    VALUES (${check.id}, ${profile.id}, 'B', ${profile.first_name})
    ON CONFLICT (check_id, role) DO NOTHING
    RETURNING id, role
  `;
  if (!participant) apiError("CONFLICT", "This check already has two participants.");

  await sql()`
    UPDATE invitations
       SET accepted_at = now()
     WHERE id = ${invitation.id}
  `;

  await sql()`
    UPDATE checks
       SET status = CASE WHEN status = 'awaiting_partner' THEN 'active' ELSE status END,
           partner_first_name_pending = NULL,
           last_activity_at = now()
     WHERE id = ${check.id}
  `;

  await track("partner_joined", {
    profileId: profile.id,
    checkId: check.id,
    role: "B",
  });

  return Response.json({
    checkId: check.id,
    role: "B",
    alreadyJoined: false,
    status: "active",
  });
});
