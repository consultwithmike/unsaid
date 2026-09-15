import { CallToAction, Layout, Paragraph } from "./components/Layout";

export interface ResultsReadyProps {
  resultsUrl: string;
  supportEmail: string;
}

/** COPY.md §15 "Results ready". Subjects never name a topic. */
export const RESULTS_READY_SUBJECT = "Your Unsaid is ready";

export default function ResultsReady({
  resultsUrl,
  supportEmail,
}: ResultsReadyProps) {
  return (
    <Layout preview={RESULTS_READY_SUBJECT} supportEmail={supportEmail}>
      <Paragraph>
        You’ve both finished. There are conversations worth having.
      </Paragraph>
      <CallToAction href={resultsUrl} label="See your Unsaid" />
    </Layout>
  );
}
