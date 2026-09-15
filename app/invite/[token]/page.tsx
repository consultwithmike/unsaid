import { getBaseUrl } from "@/lib/server-url";
import type { InvitePreview } from "@/lib/types";
import { joinInvite } from "./actions";

export const metadata = { title: "You've been invited to Check Unsaid" };

async function fetchPreview(token: string): Promise<InvitePreview> {
  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/invitations/${token}`, { cache: "no-store" });
    if (!res.ok) {
      return { inviterFirstName: "", valid: res.status !== 410, expired: res.status === 410 };
    }
    return await res.json();
  } catch {
    return { inviterFirstName: "", valid: true };
  }
}

export default async function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await fetchPreview(token);
  const inviterName = preview.inviterFirstName || "Your partner";

  if (preview.expired) {
    return (
      <div className="container-content flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="font-display text-[28px]">This invitation has expired.</h1>
        <p className="text-[var(--color-ink)]/70">
          Ask {inviterName} to create a new invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="container-content flex flex-col items-center gap-6 py-20 text-center">
      <h1 className="font-display text-[30px]">
        {inviterName} invited you to check Unsaid together.
      </h1>
      <p className="max-w-[480px] text-[17px] text-[var(--color-ink)]/80">
        You&rsquo;ll both answer the same questions independently. Your answers stay
        yours. When you&rsquo;re finished, you&rsquo;ll see the conversations worth
        having before marriage—not a score that tells you what to do.
      </p>
      <form action={joinInvite.bind(null, token)}>
        <button
          type="submit"
          className="press-scale inline-flex min-h-[52px] items-center justify-center rounded-[14px] bg-[var(--color-wine)] px-8 text-[16px] font-semibold text-white hover:bg-[var(--color-wine-dark)]"
        >
          Join {inviterName}
        </button>
      </form>
    </div>
  );
}
