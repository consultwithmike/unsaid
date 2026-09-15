import { findCheck, findInvitationByToken, listParticipants } from "@/lib/checks";
import { handler } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/invitations/:token — public preview for the `/invite/[token]` page
 * (FLOWS §1). Returns the inviter's first name and nothing else: no check id,
 * no partner data, no answers.
 */
export const GET = handler(async (_request: Request, { params }: Params) => {
  const { token } = await params;
  const invitation = await findInvitationByToken(token);

  if (!invitation) {
    return Response.json(
      { inviterFirstName: "", valid: false, expired: false },
      { status: 404 },
    );
  }

  const expired =
    Boolean(invitation.invalidated_at) ||
    new Date(invitation.expires_at).getTime() <= Date.now();

  const check = await findCheck(invitation.check_id);
  if (!check || check.deleted_at || check.status === "deleted") {
    return Response.json(
      { inviterFirstName: "", valid: false, expired: false },
      { status: 404 },
    );
  }

  const participants = await listParticipants(check.id);
  const inviter = participants.find((row) => row.role === "A");

  const payload = {
    inviterFirstName: inviter?.first_name_snapshot ?? "",
    valid: !expired && check.status !== "expired",
    expired: expired || check.status === "expired",
  };

  return Response.json(payload, {
    status: payload.expired ? 410 : 200,
    headers: { "cache-control": "no-store" },
  });
});
