import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getBaseUrl } from "@/lib/server-url";
import { ERROR_COPY } from "@/lib/copy";
import type { ApiErrorBody } from "@/lib/types";

export const metadata = { title: "Joining your Unsaid…" };

const PENDING_INVITE_COOKIE = "unsaid_pending_invite";

export default async function InviteContinuePage() {
  const jar = await cookies();
  const token = jar.get(PENDING_INVITE_COOKIE)?.value;

  if (!token) {
    return (
      <div className="container-content flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="font-display text-[26px]">Open your invitation link again.</h1>
        <Link href="/" className="text-[var(--color-wine)] underline">
          Return home
        </Link>
      </div>
    );
  }

  const base = await getBaseUrl();
  let acceptResult:
    | { ok: true; data: { checkId: string } }
    | { ok: false; error: ApiErrorBody };

  try {
    const res = await fetch(`${base}/api/invitations/${token}/accept`, {
      method: "POST",
      headers: { Cookie: jar.toString() },
      cache: "no-store",
    });
    if (res.status === 404) {
      acceptResult = {
        ok: false,
        error: { code: "NOT_IMPLEMENTED", message: ERROR_COPY.NOT_IMPLEMENTED },
      };
    } else {
      const body = await res.json().catch(() => null);
      acceptResult = res.ok
        ? { ok: true, data: body }
        : { ok: false, error: body ?? { code: "CONFLICT", message: "Something went wrong." } };
    }
  } catch {
    acceptResult = {
      ok: false,
      error: { code: "NETWORK_ERROR", message: ERROR_COPY.NETWORK_ERROR },
    };
  }

  if (acceptResult.ok) {
    jar.delete(PENDING_INVITE_COOKIE);
    redirect(`/assessment/${acceptResult.data.checkId}`);
  }

  if (acceptResult.error.code === "PROFILE_INCOMPLETE") {
    redirect(`/onboarding?next=${encodeURIComponent("/invite/continue")}`);
  }

  return (
    <div className="container-content flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="font-display text-[26px]">Couldn&rsquo;t join this Unsaid</h1>
      <p className="max-w-[420px] text-[var(--color-ink)]/75">
        {ERROR_COPY[acceptResult.error.code] ?? acceptResult.error.message}
      </p>
      <Link href="/" className="text-[var(--color-wine)] underline">
        Return home
      </Link>
    </div>
  );
}
