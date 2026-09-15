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

/** Convenience listing for the dashboard. Metadata only — never answers. */
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
    partner_first_name: string | null;
  }>`
    SELECT c.id, c.status, c.relationship_stage, c.wedding_date,
           c.partner_first_name_pending, c.payment_status, c.created_at,
           p.role, p.answer_count, p.required_count, p.completed_at,
           partner.first_name_snapshot AS partner_first_name
      FROM checks c
      JOIN check_participants p
        ON p.check_id = c.id AND p.profile_id = ${profile.id}
      LEFT JOIN check_participants partner
        ON partner.check_id = c.id AND partner.id <> p.id
     WHERE c.deleted_at IS NULL
       AND c.status <> 'deleted'
     ORDER BY c.created_at DESC
  `;

  return Response.json({
    checks: rows.map((row) => ({
      id: row.id,
      status: row.status,
      relationshipStage: row.relationship_stage,
      weddingDate: row.wedding_date,
      paymentStatus: row.payment_status,
      createdAt: row.created_at,
      role: row.role,
      completed: Boolean(row.completed_at),
      answerCount: row.answer_count,
      requiredCount: row.required_count,
      partnerFirstName: row.partner_first_name ?? row.partner_first_name_pending,
    })),
  });
});
