import { ResultItemClient } from "./ResultItemClient";

export const metadata = { title: "A conversation worth having — Unsaid" };

export default async function ResultItemPage({
  params,
}: {
  params: Promise<{ checkId: string; questionId: string }>;
}) {
  const { checkId, questionId } = await params;
  return <ResultItemClient checkId={checkId} questionId={questionId} />;
}
