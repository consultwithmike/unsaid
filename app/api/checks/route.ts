import { z } from "zod";

import { track } from "@/lib/analytics";
import {
  RELATIONSHIP_STAGES,
  issueInvitation,
  inviteUrlFor,
  type CheckRow,
} from "@/lib/checks";
import { generateDek, wrapDek } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { QUESTION_SET_VERSION } from "@/lib/env";
import { apiError, handler } from "@/lib/errors";
import { requireCompleteProfile } from "@/lib/profile";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  relationshipStage: z.enum(
    RELATIONSHIP_STAGES as [string, ...string[]],
  ),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .nullish(),
  partnerFirstName: z.string().trim().min(1).max(80),
});

/** POST /api/checks — E2E_LOCKS §1. */
export const POST = handler(async (request: Request) => {
  const profile = await requireCompleteProfile();

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    apiError("VALIDATION", parsed.error.issues[0]?.message ?? undefined);
  }
  const body = parsed.data;

  await enforceRateLimit("invite_create", profile.id);

  const wrappedDek = wrapDek(generateDek());

  const [check] = await sql()<CheckRow>`
    INSERT INTO checks (
      status, question_set_version, relationship_stage, wedding_date,
      partner_first_name_pending, created_by_profile_id, encrypted_dek
    ) VALUES (
      'awaiting_partner', ${QUESTION_SET_VERSION}, ${body.relationshipStage},
      ${body.weddingDate ?? null}, ${body.partnerFirstName}, ${profile.id},
      ${wrappedDek}
    )
    RETURNING id, status, question_set_version, relationship_stage, wedding_date,
              partner_first_name_pending, created_by_profile_id, created_at,
              expires_at, unlocked_at, payment_status, algorithm_version,
              encrypted_dek, last_activity_at, deleted_at
  `;

  await sql()`
    INSERT INTO check_participants
      (check_id, profile_id, role, first_name_snapshot)
    VALUES (${check.id}, ${profile.id}, 'A', ${profile.first_name})
  `;

  const { token, invitation } = await issueInvitation(
    check.id,
    body.partnerFirstName,
  );

  await track("check_created", { profileId: profile.id, checkId: check.id, role: "A" });

  return Response.json(
    {
      checkId: check.id,
      status: "awaiting_partner",
      inviteToken: token,
      inviteUrl: inviteUrlFor(token),
      inviteExpiresAt: new Date(invitation.expires_at).toISOString(),
    },
    { status: 201 },
  );
});

/**
 * Dashboard listing. Metadata only: the alignment index is withheld until the
 * check is unlocked, and answers never appear here.
 */
export const GET = handler(async () => {
  const profile = await requireCompleteProfile();

  const rows = await sql()<{
    id: string;
    status: string;
    relationship_stage: string;
    wedding_date: string | null;
    partner_first_name_pending: string | null;
    payment_status: string;
    created_at: string;
    role: "A" | "B";
    answer_count: number;
    required_count: number;
    completed_at: string | null;
    name_a: string | null;
    name_b: string | null;
    alignment_index: string | number | null;
    teaser_conversation_count: number | null;
  }>`
    SELECT c.id, c.status, c.relationship_stage, c.wedding_date,
           c.partner_first_name_pending, c.payment_status, c.created_at,
           p.role, p.answer_count, p.required_count, p.completed_at,
           a.first_name_snapshot AS name_a,
           b.first_name_snapshot AS name_b,
           r.alignment_index, r.teaser_conversation_count
      FROM checks c
      JOIN check_participants p
        ON p.check_id = c.id AND p.profile_id = ${profile.id}
      LEFT JOIN check_participants a ON a.check_id = c.id AND a.role = 'A'
      LEFT JOIN check_participants b ON b.check_id = c.id AND b.role = 'B'
      LEFT JOIN results r ON r.check_id = c.id
     WHERE c.deleted_at IS NULL
       AND c.status <> 'deleted'
     ORDER BY c.created_at DESC
  `;

  return Response.json({
    checks: rows.map((row) => {
      const unlocked = row.status === "unlocked" && row.payment_status === "paid";
      return {
        id: row.id,
        nameA: row.name_a,
        nameB: row.name_b ?? row.partner_first_name_pending,
        status: row.status,
        createdAt: row.created_at,
        alignmentIndex:
          unlocked && row.alignment_index !== null
            ? Math.round(Number(row.alignment_index))
            : null,
        conversationCount: row.teaser_conversation_count ?? null,
        relationshipStage: row.relationship_stage,
        weddingDate: row.wedding_date,
        paymentStatus: row.payment_status,
        role: row.role,
        completed: Boolean(row.completed_at),
        answerCount: row.answer_count,
        requiredCount: row.required_count,
      };
    }),
  });
});
