import { z } from "zod";

import { track } from "@/lib/analytics";
import { listParticipants, requireCheckContext } from "@/lib/checks";
import { sql } from "@/lib/db";
import { sendPartnerFinished, sendResultsReady } from "@/lib/email";
import { apiError, handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";
import { progressFor } from "@/lib/responses";
import { calculateResults } from "@/lib/results";

export const dynamic = "force-dynamic";

const schema = z.object({
  checkId: z.string().uuid(),
  offlineQueueCount: z.number().int().min(0).optional(),
});

async function participantEmails(
  checkId: string,
): Promise<Array<{ participantId: string; email: string; firstName: string; role: "A" | "B" }>> {
  return sql()<{
    participantId: string;
    email: string;
    firstName: string;
    role: "A" | "B";
  }>`
    SELECT cp.id AS "participantId", pr.email, cp.first_name_snapshot AS "firstName",
           cp.role
      FROM check_participants cp
      JOIN profiles pr ON pr.id = cp.profile_id
     WHERE cp.check_id = ${checkId}
  `;
}

/** POST /api/assessment/complete — FLOWS §5. */
export const POST = handler(async (request: Request) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) apiError("VALIDATION", "checkId is required.");
  const body = parsed.data;

  if ((body.offlineQueueCount ?? 0) > 0) apiError("OFFLINE_QUEUE_NONEMPTY");

  const profile = await currentProfile();
  const { check, you } = await requireCheckContext(body.checkId, profile.id);
  if (check.status === "expired") apiError("CHECK_STATE", "This check has expired.");

  const progress = await progressFor(you, check);
  if (progress.followUpsPending.length > 0) {
    apiError("FOLLOW_UP_REQUIRED", undefined, {
      followUpsPending: progress.followUpsPending,
    });
  }
  if (progress.answerCount < progress.requiredCount) {
    apiError("VALIDATION", "There are still questions left to answer.", {
      answerCount: progress.answerCount,
      requiredCount: progress.requiredCount,
    });
  }

  await sql()`
    UPDATE check_participants
       SET completed_at = COALESCE(completed_at, now())
     WHERE id = ${you.id}
  `;
  await sql()`UPDATE checks SET last_activity_at = now() WHERE id = ${check.id}`;

  await track("assessment_completed", {
    profileId: profile.id,
    checkId: check.id,
    role: you.role,
  });

  const participants = await listParticipants(check.id);
  const bothComplete =
    participants.length === 2 && participants.every((row) => row.completed_at);

  if (!bothComplete) {
    const contacts = await participantEmails(check.id);
    const partner = contacts.find((row) => row.participantId !== you.id);
    if (partner) {
      await sendPartnerFinished({
        to: partner.email,
        partnerFirstName: you.first_name_snapshot,
        checkId: check.id,
      });
    }
    return Response.json({
      completed: true,
      status: check.status,
      bothComplete: false,
    });
  }

  const results = await calculateResults({ ...check, status: check.status });
  await track("check_ready", { profileId: profile.id, checkId: check.id });

  const contacts = await participantEmails(check.id);
  await Promise.all(
    contacts.map((contact) =>
      sendResultsReady({ to: contact.email, checkId: check.id }),
    ),
  );

  return Response.json({
    completed: true,
    bothComplete: true,
    status: "ready",
    conversationCount: results.teaser_conversation_count,
    hardLineCollisionCount: results.hard_line_collision_count,
  });
});
