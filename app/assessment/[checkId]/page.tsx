import { AssessmentClient } from "@/features/assessment/AssessmentClient";

export const metadata = { title: "Your Unsaid" };

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ checkId: string }>;
}) {
  const { checkId } = await params;
  return <AssessmentClient checkId={checkId} />;
}
