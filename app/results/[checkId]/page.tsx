import { ResultsSummaryClient } from "./ResultsSummaryClient";

export const metadata = { title: "Your Unsaid — Results" };

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ checkId: string }>;
}) {
  const { checkId } = await params;
  return <ResultsSummaryClient checkId={checkId} />;
}
