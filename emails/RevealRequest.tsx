import { CallToAction, Layout, Paragraph } from "./components/Layout";

export interface RevealRequestProps {
  requesterFirstName: string;
  reviewUrl: string;
  supportEmail: string;
}

/** COPY.md §15 "Reveal request". The topic is never named in the email. */
export function revealRequestSubject(requesterFirstName: string): string {
  return `${requesterFirstName} requested a mutual reveal`;
}

export default function RevealRequest({
  requesterFirstName,
  reviewUrl,
  supportEmail,
}: RevealRequestProps) {
  return (
    <Layout
      preview={revealRequestSubject(requesterFirstName)}
      supportEmail={supportEmail}
    >
      <Paragraph>
        {requesterFirstName} would like both of you to reveal your answers to one
        flagged topic. Nothing will be revealed unless you agree.
      </Paragraph>
      <CallToAction href={reviewUrl} label="Review request" />
    </Layout>
  );
}
