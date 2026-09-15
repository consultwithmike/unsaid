import { requireCheckContext } from "@/lib/checks";
import { sql } from "@/lib/db";
import { sendPartnerInvite, sendReminder } from "@/lib/email";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";
import { enforceRateLimit } from "@/lib/rate-limit";
import { inviteUrlFor, issueInvitation } from "@/lib/checks";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST /api/checks/:id/remind — completed participant only, 1 per 24h. */
export const POST = handler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const profile = await currentProfile();
  const { check, you, partner } = await requireCheckContext(id, profile.id);

  if (!you.completed_at) {
    apiError("FORBIDDEN", "Finish your own answers before sending a reminder.");
  }
  if (partner?.completed_at) {
    apiError("CHECK_STATE", "Your partner has already finished.");
  }

  await enforceRateLimit("remind", `${check.id}:${profile.id}`);

  const body = (await request.json().catch(() => ({}))) as { partnerEmail?: string };

  if (partner) {
    const [contact] = await sql()<{ email: string }>`
      SELECT pr.email
        FROM check_participants cp
        JOIN profiles pr ON pr.id = cp.profile_id
       WHERE cp.id = ${partner.id}
    `;
    if (contact?.email) {
      await sendReminder({
        to: contact.email,
        senderFirstName: you.first_name_snapshot,
        continueUrl: `${siteUrl()}/assessment/${check.id}`,
      });
    }
  } else {
    // Partner never joined: reissue the invitation instead of a nudge.
    const email = body.partnerEmail;
    if (!email) {
      apiError("VALIDATION", "An email address is needed to resend the invitation.");
    }
    const { token } = await issueInvitation(
      check.id,
      check.partner_first_name_pending ?? "your partner",
    );
    await sendPartnerInvite({
      to: email,
      inviterFirstName: you.first_name_snapshot,
      inviteUrl: inviteUrlFor(token),
    });
  }

  await sql()`
    INSERT INTO reminder_log (check_id, sender_profile_id)
    VALUES (${check.id}, ${profile.id})
  `;

  return Response.json({ sent: true });
});
