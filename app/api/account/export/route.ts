import { track } from "@/lib/analytics";
import {
  checkDek,
  listParticipants,
  type CheckRow,
  type ParticipantRow,
} from "@/lib/checks";
import { sql } from "@/lib/db";
import { handler } from "@/lib/errors";
import { currentProfile, serializeProfile } from "@/lib/profile";
import { enforceRateLimit } from "@/lib/rate-limit";
import { loadOwnAnswers } from "@/lib/responses";
import { findResults, listResultItems } from "@/lib/results";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/export — the caller's own data only. Never the partner's
 * answers (PRIVACY invariant 11).
 */
export const GET = handler(async () => {
  const profile = await currentProfile();
  await enforceRateLimit("export", profile.id);

  const checks = await sql()<CheckRow>`
    SELECT c.id, c.status, c.question_set_version, c.relationship_stage,
           c.wedding_date, c.partner_first_name_pending, c.created_by_profile_id,
           c.created_at, c.expires_at, c.unlocked_at, c.payment_status,
           c.algorithm_version, c.encrypted_dek, c.last_activity_at, c.deleted_at
      FROM checks c
      JOIN check_participants cp
        ON cp.check_id = c.id AND cp.profile_id = ${profile.id}
     ORDER BY c.created_at ASC
  `;

  const exportedChecks = [];
  for (const check of checks) {
    const participants: ParticipantRow[] = await listParticipants(check.id);
    const you = participants.find((row) => row.profile_id === profile.id);
    if (!you) continue;

    let answers: Array<Record<string, unknown>> = [];
    try {
      const own = await loadOwnAnswers(you, check, checkDek(check));
      answers = own.map((answer) => ({
        questionCode: answer.code,
        answer: answer.answer,
        importance: answer.importance,
        hardLine: answer.hardLine,
      }));
    } catch (error) {
      console.warn(`[export] could not decrypt answers for check ${check.id}`, error);
    }

    const results = await findResults(check.id);
    const items = results ? await listResultItems(check.id) : [];

    exportedChecks.push({
      id: check.id,
      status: check.status,
      relationshipStage: check.relationship_stage,
      weddingDate: check.wedding_date,
      questionSetVersion: check.question_set_version,
      algorithmVersion: check.algorithm_version,
      createdAt: check.created_at,
      unlockedAt: check.unlocked_at,
      paymentStatus: check.payment_status,
      yourRole: you.role,
      yourCompletedAt: you.completed_at,
      yourAnswers: answers,
      summary: results
        ? {
            alignmentIndex: Number(results.alignment_index),
            alignedCount: results.aligned_count,
            minorCount: results.minor_count,
            conversationCount: results.conversation_count,
            majorCount: results.major_count,
            hardLineCollisionCount: results.hard_line_collision_count,
            categoryScores: results.category_scores ?? [],
            generatedAt: results.generated_at,
          }
        : null,
      items: items.map((item) => ({
        questionCode: item.code,
        category: item.category,
        classification: item.classification,
        hardLineCollision: item.hard_line_collision,
        discussedAt: item.discussed_at,
        revealStatus: item.reveal_status ?? "none",
      })),
    });
  }

  const receipts = await sql()<{
    check_id: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
  }>`
    SELECT p.check_id, p.amount, p.currency, p.status, p.created_at
      FROM payments p
     WHERE p.purchasing_clerk_user_id = ${profile.clerk_user_id}
     ORDER BY p.created_at ASC
  `;

  await track("account_exported", { profileId: profile.id });

  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      profile: serializeProfile(profile),
      checks: exportedChecks,
      paymentReceipts: receipts.map((receipt) => ({
        checkId: receipt.check_id,
        amountCents: receipt.amount,
        currency: receipt.currency,
        status: receipt.status,
        createdAt: receipt.created_at,
      })),
    },
    null,
    2,
  );

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="unsaid-export-${Date.now()}.json"`,
      "cache-control": "no-store",
    },
  });
});
