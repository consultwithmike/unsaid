import { sql } from "./db";
import { apiError } from "./errors";
import { unwrapDek } from "./crypto";

export type CheckStatus =
  | "awaiting_partner"
  | "active"
  | "ready"
  | "unlocked"
  | "expired"
  | "deleted";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export type RelationshipStage =
  | "seriously_dating"
  | "discussing_engagement"
  | "engaged"
  | "wedding_scheduled"
  | "other";

export const RELATIONSHIP_STAGES: RelationshipStage[] = [
  "seriously_dating",
  "discussing_engagement",
  "engaged",
  "wedding_scheduled",
  "other",
];

export interface CheckRow {
  id: string;
  status: CheckStatus;
  question_set_version: string;
  relationship_stage: RelationshipStage;
  wedding_date: string | null;
  partner_first_name_pending: string | null;
  created_by_profile_id: string;
  created_at: string;
  expires_at: string | null;
  unlocked_at: string | null;
  payment_status: PaymentStatus;
  algorithm_version: string | null;
  encrypted_dek: Uint8Array | Buffer | null;
  last_activity_at: string;
  deleted_at: string | null;
}

export interface ParticipantRow {
  id: string;
  check_id: string;
  profile_id: string;
  role: "A" | "B";
  first_name_snapshot: string;
  joined_at: string;
  completed_at: string | null;
  answer_count: number;
  required_count: number;
  follow_ups_required: string[];
}

export interface CheckContext {
  check: CheckRow;
  you: ParticipantRow;
  partner: ParticipantRow | null;
  participants: ParticipantRow[];
}

const CHECK_COLUMNS = `id, status, question_set_version, relationship_stage,
  wedding_date, partner_first_name_pending, created_by_profile_id, created_at,
  expires_at, unlocked_at, payment_status, algorithm_version, encrypted_dek,
  last_activity_at, deleted_at`;

export async function findCheck(checkId: string): Promise<CheckRow | null> {
  const rows = await sql()<CheckRow>`
    SELECT id, status, question_set_version, relationship_stage, wedding_date,
           partner_first_name_pending, created_by_profile_id, created_at,
           expires_at, unlocked_at, payment_status, algorithm_version,
           encrypted_dek, last_activity_at, deleted_at
      FROM checks
     WHERE id = ${checkId}
  `;
  return rows[0] ?? null;
}

export async function listParticipants(checkId: string): Promise<ParticipantRow[]> {
  const rows = await sql()<ParticipantRow>`
    SELECT id, check_id, profile_id, role, first_name_snapshot, joined_at,
           completed_at, answer_count, required_count, follow_ups_required
      FROM check_participants
     WHERE check_id = ${checkId}
     ORDER BY role ASC
  `;
  return rows;
}

/** Loads a check the caller participates in, or throws NOT_FOUND / FORBIDDEN. */
export async function requireCheckContext(
  checkId: string,
  profileId: string,
): Promise<CheckContext> {
  if (!isUuid(checkId)) apiError("NOT_FOUND");
  const check = await findCheck(checkId);
  if (!check || check.deleted_at || check.status === "deleted") apiError("NOT_FOUND");

  const participants = await listParticipants(checkId);
  const you = participants.find((row) => row.profile_id === profileId);
  if (!you) apiError("FORBIDDEN");

  return {
    check,
    you,
    partner: participants.find((row) => row.id !== you.id) ?? null,
    participants,
  };
}

export function checkDek(check: CheckRow): Buffer {
  if (!check.encrypted_dek) {
    throw new Error(`Check ${check.id} has no encrypted DEK`);
  }
  return unwrapDek(check.encrypted_dek as Uint8Array);
}

export async function touchCheck(checkId: string): Promise<void> {
  await sql()`UPDATE checks SET last_activity_at = now() WHERE id = ${checkId}`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Refunded checks are served as the locked teaser even though `status` may
 * still read `unlocked` for a moment (E2E_LOCKS §2, PRIVACY invariant 12).
 */
export function isUnlocked(check: CheckRow): boolean {
  return check.status === "unlocked" && check.payment_status === "paid";
}

export function progressPct(answerCount: number, requiredCount: number): number {
  if (requiredCount <= 0) return 0;
  return Math.floor((100 * answerCount) / requiredCount);
}

/** `GET /api/checks/:id` payload — E2E_LOCKS §10. */
export function serializeCheck(context: CheckContext) {
  const { check, you, partner } = context;
  return {
    id: check.id,
    status: check.status,
    relationshipStage: check.relationship_stage,
    weddingDate: check.wedding_date,
    you: {
      role: you.role,
      firstName: you.first_name_snapshot,
      completed: Boolean(you.completed_at),
      answerCount: you.answer_count,
      requiredCount: you.required_count,
      pct: progressPct(you.answer_count, you.required_count),
    },
    partner: partner
      ? {
          role: partner.role,
          firstName: partner.first_name_snapshot,
          joined: true,
          completed: Boolean(partner.completed_at),
          answerCount: partner.answer_count,
          requiredCount: partner.required_count,
          pct: progressPct(partner.answer_count, partner.required_count),
        }
      : {
          role: you.role === "A" ? "B" : "A",
          firstName: check.partner_first_name_pending,
          joined: false,
          completed: false,
          answerCount: 0,
          requiredCount: null,
          pct: 0,
        },
    inviteExpiresAt: check.expires_at,
    paymentStatus: check.payment_status,
    unlockedAt: check.unlocked_at,
  };
}
