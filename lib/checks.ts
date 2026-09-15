import { sql } from "./db";
import { apiError } from "./errors";
import { generateInviteToken, hashInviteToken, unwrapDek } from "./crypto";
import { INVITE_TTL_DAYS, siteUrl } from "./env";

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

// ---------------------------------------------------------------------------
// Invitations (E2E_LOCKS §1, §3)
// ---------------------------------------------------------------------------

export interface InvitationRow {
  id: string;
  check_id: string;
  token_hash: string;
  partner_first_name_pending: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  invalidated_at: string | null;
}

export function inviteExpiryFromNow(): Date {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function inviteUrlFor(token: string): string {
  return `${siteUrl()}/invite/${token}`;
}

/**
 * Issues a fresh invitation for a check and invalidates any earlier one. The
 * raw token is returned exactly once; only its hash is persisted.
 */
export async function issueInvitation(
  checkId: string,
  partnerFirstName: string,
): Promise<{ token: string; invitation: InvitationRow }> {
  const token = generateInviteToken();
  const expiresAt = inviteExpiryFromNow();

  await sql()`
    UPDATE invitations
       SET invalidated_at = now()
     WHERE check_id = ${checkId}
       AND accepted_at IS NULL
       AND invalidated_at IS NULL
  `;

  const [invitation] = await sql()<InvitationRow>`
    INSERT INTO invitations
      (check_id, token_hash, partner_first_name_pending, expires_at)
    VALUES (
      ${checkId}, ${hashInviteToken(token)}, ${partnerFirstName},
      ${expiresAt.toISOString()}
    )
    RETURNING id, check_id, token_hash, partner_first_name_pending, expires_at,
              accepted_at, created_at, invalidated_at
  `;

  await sql()`
    UPDATE checks
       SET partner_first_name_pending = ${partnerFirstName},
           expires_at = ${expiresAt.toISOString()},
           last_activity_at = now()
     WHERE id = ${checkId}
  `;

  return { token, invitation };
}

export async function findInvitationByToken(
  token: string,
): Promise<InvitationRow | null> {
  const rows = await sql()<InvitationRow>`
    SELECT id, check_id, token_hash, partner_first_name_pending, expires_at,
           accepted_at, created_at, invalidated_at
      FROM invitations
     WHERE token_hash = ${hashInviteToken(token)}
  `;
  return rows[0] ?? null;
}

export function assertInvitationUsable(invitation: InvitationRow): void {
  if (invitation.invalidated_at) apiError("INVITE_EXPIRED");
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    apiError("INVITE_EXPIRED");
  }
}
