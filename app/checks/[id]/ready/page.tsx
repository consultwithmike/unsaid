import { ReadyClient } from "./ReadyClient";

export const metadata = { title: "Your Unsaid is ready" };

export default async function ReadyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReadyClient checkId={id} />;
}
