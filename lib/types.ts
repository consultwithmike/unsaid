/**
 * Contract types mirrored from docs/API_CONTRACT.md and docs/E2E_LOCKS.md.
 * UI-only slice: these types describe API shapes so pages can be built
 * against the contract even before app/api/** exists.
 */

export type RelationshipStage =
  | "seriously_dating"
  | "discussing_engagement"
  | "engaged"
  | "wedding_scheduled"
  | "other";

export type CheckStatus =
  | "awaiting_partner"
  | "active"
  | "ready"
  | "unlocked"
  | "expired"
  | "deleted";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export interface Profile {
  firstName: string;
  preferredName?: string | null;
  pronouns?: string | null;
  ageConfirmed18: boolean;
}

export interface MeResponse {
  profile: Profile | null;
  complete: boolean;
}

export interface CreateCheckRequest {
  relationshipStage: RelationshipStage;
  weddingDate: string | null;
  partnerFirstName: string;
}

export interface CreateCheckResponse {
  checkId: string;
  status: CheckStatus;
  inviteToken: string;
  inviteUrl: string;
  inviteExpiresAt: string;
}

export interface CheckParticipantView {
  role: "A" | "B";
  firstName: string;
  joined?: boolean;
  completed: boolean;
  answerCount: number;
  requiredCount: number;
  pct: number;
}

export interface CheckDetail {
  id: string;
  status: CheckStatus;
  relationshipStage: RelationshipStage;
  weddingDate: string | null;
  you: CheckParticipantView;
  partner: CheckParticipantView & { joined: boolean };
  inviteExpiresAt: string | null;
  paymentStatus: PaymentStatus;
  unlockedAt: string | null;
}

export interface DashboardCheckRow {
  id: string;
  nameA: string;
  nameB: string | null;
  status: CheckStatus;
  createdAt: string;
  alignmentIndex: number | null;
  conversationCount: number | null;
}

export interface InvitePreview {
  inviterFirstName: string;
  valid: boolean;
  expired?: boolean;
}

export interface ResumeAnswer {
  questionId: string;
  code: string;
  answer: number | string | string[];
  importance: number;
  hardLine: boolean;
}

export interface SectionProgress {
  index: number;
  answeredInSection: number;
  sectionSize: number;
}

export interface ResponsesResumeResponse {
  participantId: string;
  answerCount: number;
  requiredCount: number;
  followUpsPending: string[];
  currentSectionId: string | null;
  currentQuestionCode: string | null;
  sectionProgress: SectionProgress | null;
  answers: ResumeAnswer[];
}

export interface SubmitResponseRequest {
  checkId: string;
  questionCode: string;
  answer: number | string | string[];
  importance: number;
  hardLine: boolean;
}

export type ResultBand =
  | "mostly_aligned"
  | "some_important_differences"
  | "several_important_differences"
  | "major_differences";

export interface ResultsCounts {
  aligned: number;
  minor: number;
  conversation: number;
  major: number;
  hardLineCollisions: number;
}

export interface CategoryScore {
  sectionId: string;
  label: string;
  alignmentIndex: number;
}

export type ItemClassification =
  | "aligned"
  | "slight"
  | "conversation"
  | "major"
  | "major_conversation";

export type RevealStatus = "none" | "requested_by_a" | "requested_by_b" | "mutual";

export interface ResultItemSummary {
  questionId: string;
  code: string;
  category: string;
  title: string;
  classification: ItemClassification;
  hardLineCollision: boolean;
  impact: number;
  distance: number;
  neutralDescription: string;
  prompts: string[];
  discussedAt: string | null;
  revealStatus: RevealStatus;
}

export interface ResultsReadyResponse {
  status: "ready";
  locked: true;
  names: { a: string; b: string };
  conversationCount: number;
  hardLineCollisionCount: number;
  alignmentIndex: null;
  counts: null;
  categoryScores: null;
  items: null;
  priceCents: number;
  currency: string;
}

export interface ResultsUnlockedResponse {
  status: "unlocked";
  locked: false;
  names: { a: string; b: string };
  alignmentIndex: number;
  alignmentBand: ResultBand;
  counts: ResultsCounts;
  categoryScores: CategoryScore[];
  items: ResultItemSummary[];
}

export type ResultsResponse = ResultsReadyResponse | ResultsUnlockedResponse;

export interface ResultItemDetail extends ResultItemSummary {
  ownAnswer?: number | string | string[];
  partnerAnswer?: number | string | string[];
}

export interface ApiErrorBody {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "PROFILE_INCOMPLETE"
    | "NOT_FOUND"
    | "INVITE_EXPIRED"
    | "INVITE_LOCKED"
    | "SELF_JOIN"
    | "CHECK_STATE"
    | "VALIDATION"
    | "FOLLOW_UP_REQUIRED"
    | "OFFLINE_QUEUE_NONEMPTY"
    | "RATE_LIMITED"
    | "PAYMENT_REQUIRED"
    | "CONFLICT"
    | "NOT_IMPLEMENTED"
    | "NETWORK_ERROR";
  message: string;
}
