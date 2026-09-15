import { z } from "zod";

import { track } from "@/lib/analytics";
import { issueInvitation, inviteUrlFor, requireCheckContext } from "@/lib/checks";
import { sendPartnerInvite } from "@/lib/email";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const replaceSchema = z.object({
  partnerFirstName: z.string().trim().min(1).max(80).optional(),
  partnerEmail: z.string().trim().email().optional(),
});

/** POST /api/checks/:id/invite — replace invite rules in E2E_LOCKS §3. */
export const POST = handler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const profile = await currentProfile();
  const { check, you, partner } = await requireCheckContext(id, profile.id);

  if (you.role !== "A") apiError("FORBIDDEN", "Only the person who created this check can resend the invitation.");
  if (check.status === "expired") apiError("CHECK_STATE", "This check has expired.");
  if (check.status === "ready" || check.status === "unlocked") {
    apiError("CHECK_STATE", "Both of you have already finished.");
  }

  // Allowed while B has not joined, or has joined but not answered anything.
  if (partner && (partner.answer_count > 0 || partner.completed_at)) {
    apiError("INVITE_LOCKED");
  }

  await enforceRateLimit("invite_replace", check.id);

  const parsed = replaceSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) apiError("VALIDATION", "Check the fields and try again.");

  const partnerFirstName =
    parsed.data.partnerFirstName ??
    partner?.first_name_snapshot ??
    check.partner_first_name_pending ??
    "your partner";

  const { token, invitation } = await issueInvitation(check.id, partnerFirstName);
  const inviteUrl = inviteUrlFor(token);

  if (parsed.data.partnerEmail) {
    await sendPartnerInvite({
      to: parsed.data.partnerEmail,
      inviterFirstName: you.first_name_snapshot,
      inviteUrl,
    });
  }

  await track("invite_sent", {
    profileId: profile.id,
    checkId: check.id,
    role: you.role,
  });

  return Response.json({
    checkId: check.id,
    inviteToken: token,
    inviteUrl,
    inviteExpiresAt: new Date(invitation.expires_at).toISOString(),
  });
});
