import { CallToAction, Layout, Paragraph } from "./components/Layout";

export interface PartnerInviteProps {
  inviterFirstName: string;
  inviteUrl: string;
  supportEmail: string;
}

/** COPY.md §15 "Partner invitation". */
export function partnerInviteSubject(inviterFirstName: string): string {
  return `${inviterFirstName} wants to Check Unsaid with you`;
}

export default function PartnerInvite({
  inviterFirstName,
  inviteUrl,
  supportEmail,
}: PartnerInviteProps) {
  return (
    <Layout
      preview={partnerInviteSubject(inviterFirstName)}
      supportEmail={supportEmail}
    >
      <Paragraph>
        {inviterFirstName} invited you to privately answer Unsaid together. You’ll both
        answer the same questions independently. Your answers stay yours. When you’re
        finished, you’ll see the conversations worth having before marriage.
      </Paragraph>
      <CallToAction href={inviteUrl} label={`Join ${inviterFirstName}`} />
    </Layout>
  );
}
