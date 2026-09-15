import { sql } from "./db";

/** First-party analytics allowlist — E2E_LOCKS §11. Nothing else is stored. */
export const ANALYTICS_EVENTS = [
  "landing_viewed",
  "start_clicked",
  "check_created",
  "invite_sent",
  "partner_joined",
  "assessment_started",
  "section_completed",
  "assessment_completed",
  "check_ready",
  "checkout_started",
  "checkout_completed",
  "results_viewed",
  "conversation_opened",
  "reveal_requested",
  "reveal_completed",
  "check_deleted",
  "retake_started",
  "share_tapped",
  "account_exported",
  "account_deleted",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const ALLOWED = new Set<string>(ANALYTICS_EVENTS);

export function isAllowedEvent(name: string): name is AnalyticsEvent {
  return ALLOWED.has(name);
}

/**
 * Allowed props only: opaque checkId, role, sectionIndex (0–11), source and a
 * numeric value. Never answers, importance, hard lines, or topics.
 */
export interface AnalyticsProps {
  profileId?: string | null;
  checkId?: string | null;
  role?: "A" | "B" | null;
  sectionIndex?: number | null;
  source?: string | null;
  value?: number | null;
}

export async function track(
  event: AnalyticsEvent,
  props: AnalyticsProps = {},
): Promise<void> {
  if (!isAllowedEvent(event)) return;

  const sectionIndex =
    typeof props.sectionIndex === "number" &&
    Number.isInteger(props.sectionIndex) &&
    props.sectionIndex >= 0 &&
    props.sectionIndex <= 11
      ? props.sectionIndex
      : null;

  try {
    await sql()`
      INSERT INTO analytics_events
        (event_name, profile_id, check_id, role, section_index, source, value)
      VALUES (
        ${event},
        ${props.profileId ?? null},
        ${props.checkId ?? null},
        ${props.role ?? null},
        ${sectionIndex},
        ${props.source ?? null},
        ${typeof props.value === "number" ? props.value : null}
      )
    `;
  } catch (error) {
    // Analytics must never break a product request.
    console.warn("[analytics] insert failed", error);
  }
}
