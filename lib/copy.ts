/**
 * All product copy is sourced verbatim from docs/COPY.md. Do not invent
 * language here — add new strings only by copying from that file.
 */

export const BRAND = "Unsaid";
export const TAGLINE = "Before you wed. Check Unsaid.";
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL_PUBLIC ?? "support@unsaid.app";

export const LEGAL_PARAGRAPH =
  "Unsaid identifies differences between the answers you provide. It cannot determine whether a relationship will succeed or what decisions you should make. Unsaid is a structured communication tool—not therapy, counseling, diagnosis, or medical advice. You must be 18 or older.";

export const LEGAL_STUB_BODY = `Full policy forthcoming. Until then: Unsaid identifies differences between the answers you provide. It cannot determine whether a relationship will succeed. You must be 18+. Relationship answers are never sold or used for advertising. Contact ${SUPPORT_EMAIL}.`;

export const IMPORTANCE_LABELS: Record<number, string> = {
  1: "Not much",
  2: "Somewhat",
  3: "Important",
  4: "Very important",
  5: "Essential",
};

export const HARD_LINE_QUESTION =
  "Could a major difference here stop you from moving forward with marriage?";
export const HARD_LINE_TOGGLE = "This is a hard line for me.";

export const BAND_LABELS: Record<string, string> = {
  mostly_aligned: "Mostly aligned",
  some_important_differences: "Some important differences",
  several_important_differences: "Several important differences",
  major_differences: "Major differences worth understanding",
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  aligned: "Aligned",
  slight: "Small difference",
  conversation: "Conversation",
  major: "Major conversation",
  major_conversation: "Major conversation",
};

export const ERROR_COPY: Record<string, string> = {
  UNAUTHORIZED: "Please sign in to continue.",
  FORBIDDEN: "You don't have access to this.",
  PROFILE_INCOMPLETE: "Tell us your first name and confirm you're 18+ to continue.",
  NOT_FOUND: "We couldn't find that.",
  INVITE_EXPIRED: "This invitation has expired. Ask them to create a new invitation.",
  INVITE_LOCKED: "This invitation can no longer be replaced.",
  SELF_JOIN: "You can't accept your own invitation. Share the link with your partner.",
  CHECK_STATE: "This Unsaid isn't in the right state for that yet.",
  VALIDATION: "Please check your answer and try again.",
  FOLLOW_UP_REQUIRED: "One more detail is needed before continuing.",
  OFFLINE_QUEUE_NONEMPTY: "You're offline. We'll save this answer when your connection returns.",
  RATE_LIMITED: "Please wait before trying again.",
  PAYMENT_REQUIRED: "That payment didn't go through. Nothing has been charged by Unsaid.",
  CONFLICT: "Something changed — please refresh and try again.",
  NOT_IMPLEMENTED: "This part of Unsaid is still being built. Check back soon.",
  NETWORK_ERROR: "You're offline. We'll save this answer when your connection returns.",
};

export const RELATIONSHIP_STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "seriously_dating", label: "Seriously dating" },
  { value: "discussing_engagement", label: "Discussing engagement" },
  { value: "engaged", label: "Engaged" },
  { value: "wedding_scheduled", label: "Wedding scheduled" },
  { value: "other", label: "Other" },
];
