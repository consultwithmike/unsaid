import { UnlockClient } from "./UnlockClient";

export const metadata = { title: "Confirming payment — Unsaid" };

export default async function UnlockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UnlockClient checkId={id} />;
}
