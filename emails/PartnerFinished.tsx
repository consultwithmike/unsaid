import { CallToAction, Layout, Paragraph } from "./components/Layout";

export interface PartnerFinishedProps {
  partnerFirstName: string;
  continueUrl: string;
  supportEmail: string;
}

/** COPY.md §15 "Partner finished". */
export function partnerFinishedSubject(partnerFirstName: string): string {
  return `${partnerFirstName} finished Unsaid`;
}

export default function PartnerFinished({
  partnerFirstName,
  continueUrl,
  supportEmail,
}: PartnerFinishedProps) {
  return (
    <Layout
      preview={partnerFinishedSubject(partnerFirstName)}
      supportEmail={supportEmail}
    >
      <Paragraph>
        {partnerFirstName} has completed their side. Your answers remain private. When
        you finish yours, your comparison can be created.
      </Paragraph>
      <CallToAction href={continueUrl} label="Continue Unsaid" />
    </Layout>
  );
}
