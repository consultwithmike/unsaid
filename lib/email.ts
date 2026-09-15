import { render } from "@react-email/components";
import { Resend } from "resend";
import type * as React from "react";

import { readEnv, siteUrl, supportEmail } from "./env";
import PartnerFinished, {
  partnerFinishedSubject,
} from "@/emails/PartnerFinished";
import PartnerInvite, { partnerInviteSubject } from "@/emails/PartnerInvite";
import Reminder, { REMINDER_SUBJECT } from "@/emails/Reminder";
import ResultsReady, { RESULTS_READY_SUBJECT } from "@/emails/ResultsReady";
import RevealRequest, { revealRequestSubject } from "@/emails/RevealRequest";

type EmailMode = "log" | "resend";

function emailMode(): EmailMode {
  const explicit = readEnv("EMAIL_MODE");
  if (explicit === "resend" || explicit === "log") return explicit;
  // EMAIL_MODE=log sinks email when no key is configured (E2E_LOCKS §15).
  return readEnv("RESEND_API_KEY") ? "resend" : "log";
}

function from(): string {
  return readEnv("EMAIL_FROM") ?? "Unsaid <noreply@unsaid.app>";
}

let resendClient: Resend | undefined;

function resend(): Resend {
  if (!resendClient) {
    const key = readEnv("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY is required when EMAIL_MODE=resend");
    resendClient = new Resend(key);
  }
  return resendClient;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  template: React.ReactElement;
}

/**
 * Sends one transactional email. Failures are logged and swallowed: email is
 * never allowed to fail a product request.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const mode = emailMode();
  let html: string;
  let text: string;
  try {
    html = await render(input.template);
    text = await render(input.template, { plainText: true });
  } catch (error) {
    console.error("[email] render failed", error);
    return;
  }

  if (mode === "log") {
    console.info(
      `[email:log] to=${input.to} subject=${JSON.stringify(input.subject)}\n${text}`,
    );
    return;
  }

  try {
    await resend().emails.send({
      from: from(),
      to: input.to,
      subject: input.subject,
      html,
      text,
    });
  } catch (error) {
    console.error("[email] send failed", error);
  }
}

// ---------------------------------------------------------------------------
// Template senders (EMAILS.md / COPY.md §15)
// ---------------------------------------------------------------------------

export async function sendPartnerInvite(options: {
  to: string;
  inviterFirstName: string;
  inviteUrl: string;
}): Promise<void> {
  await sendEmail({
    to: options.to,
    subject: partnerInviteSubject(options.inviterFirstName),
    template: PartnerInvite({
      inviterFirstName: options.inviterFirstName,
      inviteUrl: options.inviteUrl,
      supportEmail: supportEmail(),
    }),
  });
}

export async function sendReminder(options: {
  to: string;
  senderFirstName: string;
  continueUrl: string;
}): Promise<void> {
  await sendEmail({
    to: options.to,
    subject: REMINDER_SUBJECT,
    template: Reminder({
      senderFirstName: options.senderFirstName,
      continueUrl: options.continueUrl,
      supportEmail: supportEmail(),
    }),
  });
}

export async function sendPartnerFinished(options: {
  to: string;
  partnerFirstName: string;
  checkId: string;
}): Promise<void> {
  await sendEmail({
    to: options.to,
    subject: partnerFinishedSubject(options.partnerFirstName),
    template: PartnerFinished({
      partnerFirstName: options.partnerFirstName,
      continueUrl: `${siteUrl()}/assessment/${options.checkId}`,
      supportEmail: supportEmail(),
    }),
  });
}

export async function sendResultsReady(options: {
  to: string;
  checkId: string;
}): Promise<void> {
  await sendEmail({
    to: options.to,
    subject: RESULTS_READY_SUBJECT,
    template: ResultsReady({
      resultsUrl: `${siteUrl()}/results/${options.checkId}`,
      supportEmail: supportEmail(),
    }),
  });
}

export async function sendRevealRequest(options: {
  to: string;
  requesterFirstName: string;
  checkId: string;
  questionId: string;
}): Promise<void> {
  await sendEmail({
    to: options.to,
    subject: revealRequestSubject(options.requesterFirstName),
    template: RevealRequest({
      requesterFirstName: options.requesterFirstName,
      reviewUrl: `${siteUrl()}/results/${options.checkId}/items/${options.questionId}`,
      supportEmail: supportEmail(),
    }),
  });
}
