import { track } from "@/lib/analytics";
import { isUnlocked, isUuid, requireCheckContext } from "@/lib/checks";
import { sql } from "@/lib/db";
import { sendRevealRequest } from "@/lib/email";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";
import { enforceRateLimit } from "@/lib/rate-limit";
import { findResultItem } from "@/lib/results";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ checkId: string; questionId: string }> };

interface RevealRow {
  status: "none" | "requested_by_a" | "requested_by_b" | "mutual";
  participant_a_consent: boolean;
  participant_b_consent: boolean;
  revealed_at: string | null;
}

/**
 * POST /api/results/:checkId/items/:questionId/reveal
 *
 * `none` → `requested_by_a|b` → `mutual`. Mutual is irreversible
 * (API_CONTRACT §7).
 */
export const POST = handler(async (_request: Request, { params }: Params) => {
  const { checkId, questionId } = await params;
  if (!isUuid(questionId)) apiError("NOT_FOUND");

  const profile = await currentProfile();
  const { check, you, participants } = await requireCheckContext(checkId, profile.id);
  if (!isUnlocked(check)) apiError("PAYMENT_REQUIRED");

  const item = await findResultItem(check.id, questionId);
  if (!item) apiError("NOT_FOUND");

  await enforceRateLimit("reveal_request", check.id);

  const aConsent = you.role === "A";
  const bConsent = you.role === "B";

  const [reveal] = await sql()<RevealRow>`
    INSERT INTO reveals (
      check_id, question_id, status, participant_a_consent, participant_b_consent
    ) VALUES (
      ${check.id}, ${questionId},
      ${you.role === "A" ? "requested_by_a" : "requested_by_b"},
      ${aConsent}, ${bConsent}
    )
    ON CONFLICT (check_id, question_id) DO UPDATE
      SET participant_a_consent = reveals.participant_a_consent OR ${aConsent},
          participant_b_consent = reveals.participant_b_consent OR ${bConsent},
          status = CASE
            WHEN reveals.status = 'mutual' THEN 'mutual'
            WHEN (reveals.participant_a_consent OR ${aConsent})
             AND (reveals.participant_b_consent OR ${bConsent}) THEN 'mutual'
            WHEN (reveals.participant_a_consent OR ${aConsent}) THEN 'requested_by_a'
            ELSE 'requested_by_b'
          END,
          revealed_at = CASE
            WHEN reveals.revealed_at IS NOT NULL THEN reveals.revealed_at
            WHEN (reveals.participant_a_consent OR ${aConsent})
             AND (reveals.participant_b_consent OR ${bConsent}) THEN now()
            ELSE NULL
          END
    RETURNING status, participant_a_consent, participant_b_consent, revealed_at
  `;

  if (reveal.status === "mutual") {
    await track("reveal_completed", {
      profileId: profile.id,
      checkId: check.id,
      role: you.role,
    });
  } else {
    await track("reveal_requested", {
      profileId: profile.id,
      checkId: check.id,
      role: you.role,
    });

    const partner = participants.find((row) => row.id !== you.id);
    if (partner) {
      const [contact] = await sql()<{ email: string }>`
        SELECT pr.email
          FROM check_participants cp
          JOIN profiles pr ON pr.id = cp.profile_id
         WHERE cp.id = ${partner.id}
      `;
      if (contact?.email) {
        await sendRevealRequest({
          to: contact.email,
          requesterFirstName: you.first_name_snapshot,
          checkId: check.id,
          questionId,
        });
      }
    }
  }

  return Response.json({
    questionId,
    revealStatus: reveal.status,
    revealedAt: reveal.revealed_at,
  });
});
