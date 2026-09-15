import { CallToAction, Layout, Paragraph } from "./components/Layout";

export interface ReminderProps {
  senderFirstName: string;
  continueUrl: string;
  supportEmail: string;
}

/** COPY.md §15 "Reminder". */
export const REMINDER_SUBJECT = "Reminder: your Unsaid invitation";

export default function Reminder({
  senderFirstName,
  continueUrl,
  supportEmail,
}: ReminderProps) {
  return (
    <Layout preview={REMINDER_SUBJECT} supportEmail={supportEmail}>
      <Paragraph>
        {senderFirstName} is waiting to Check Unsaid with you. Your answers stay
        private.
      </Paragraph>
      <CallToAction href={continueUrl} label="Continue Unsaid" />
    </Layout>
  );
}
