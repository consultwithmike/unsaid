"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import type { ResultsResponse } from "@/lib/types";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

export function UnlockClient({ checkId }: { checkId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"confirming" | "success" | "timeout">("confirming");
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      const result = await apiGet<ResultsResponse>(`/api/results/${checkId}`);
      if (result.ok && result.data.status === "unlocked") {
        setState("success");
        setTimeout(() => {
          if (!cancelled) router.push(`/results/${checkId}`);
        }, 900);
        return;
      }
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setState("timeout");
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [checkId, router]);

  return (
    <div className="container-content flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      {state === "confirming" && (
        <h1 className="font-display text-[26px]">Confirming payment…</h1>
      )}
      {state === "success" && (
        <h1 className="unlock-pop font-display text-[26px] text-[var(--color-wine)]">
          Opening your Unsaid…
        </h1>
      )}
      {state === "timeout" && (
        <>
          <h1 className="font-display text-[26px]">
            We&rsquo;re still confirming your payment.
          </h1>
          <p className="max-w-[420px] text-[var(--color-ink)]/75">
            If you were charged, refresh in a minute or contact support.
          </p>
          <Link href={`/checks/${checkId}/ready`} className="text-[var(--color-wine)] underline">
            Return to ready screen
          </Link>
        </>
      )}
    </div>
  );
}
