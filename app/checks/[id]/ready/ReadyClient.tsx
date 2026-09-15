"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost } from "@/lib/api-client";
import type { CheckDetail, ResultsResponse } from "@/lib/types";

export function ReadyClient({ checkId }: { checkId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const cancelled = params.get("checkout") === "cancelled";

  const [check, setCheck] = useState<CheckDetail | null>(null);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const checkResult = await apiGet<CheckDetail>(`/api/checks/${checkId}`);
      if (checkResult.ok) {
        setCheck(checkResult.data);
        if (checkResult.data.status === "unlocked") {
          router.replace(`/results/${checkId}`);
          return;
        }
        if (checkResult.data.status === "ready") {
          const resultsResult = await apiGet<ResultsResponse>(`/api/results/${checkId}`);
          if (resultsResult.ok) setResults(resultsResult.data);
        }
      } else {
        setLoadFailed(true);
      }
    })();
  }, [checkId, router]);

  async function sendReminder() {
    const result = await apiPost(`/api/checks/${checkId}/remind`);
    if (result.ok) setReminderSent(true);
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setError(null);
    const result = await apiPost<{ url?: string; checkoutUrl?: string }>(
      `/api/checks/${checkId}/checkout`,
    );
    setCheckoutLoading(false);
    if (result.ok) {
      const destination = result.data.checkoutUrl ?? result.data.url;
      if (destination) window.location.href = destination;
    } else {
      setError(
        result.error.code === "NOT_IMPLEMENTED"
          ? "Checkout isn't available yet. Check back soon."
          : result.error.message,
      );
    }
  }

  if (loadFailed) {
    return (
      <div className="container-content flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="font-display text-[26px]">We couldn&rsquo;t load this Unsaid.</h1>
      </div>
    );
  }

  if (!check) {
    return <div className="container-content py-20 text-center text-[var(--color-ink)]/50">Loading…</div>;
  }

  // Waiting on partner — COPY §10.
  if (check.status !== "ready" || !results || results.status !== "ready") {
    const partnerFirstName = check.partner.firstName || "your partner";
    return (
      <div className="container-content flex flex-col items-center gap-6 py-20 text-center">
        <h1 className="font-display text-[28px]">You&rsquo;ve said your part.</h1>
        <p className="max-w-[440px] text-[var(--color-ink)]/75">
          {partnerFirstName} is still completing theirs. Your answers remain private
          while you wait.
        </p>
        <p className="text-sm text-[var(--color-ink)]/60">
          You ✓ Complete · {partnerFirstName} — {check.partner.pct ?? 0}%
        </p>
        <Button onClick={sendReminder} disabled={reminderSent}>
          {reminderSent ? "Reminder sent" : "Send reminder"}
        </Button>
        {check.inviteExpiresAt && (
          <p className="text-sm text-[var(--color-ink)]/50">
            Still waiting on {partnerFirstName}. Your invitation remains active.
          </p>
        )}
      </div>
    );
  }

  const r = results;

  return (
    <div className="container-content flex flex-col items-center gap-6 py-20 text-center">
      {cancelled && (
        <p className="rounded-[14px] bg-[var(--color-stone)] px-4 py-3 text-sm">
          Checkout was cancelled. Nothing has been charged.
        </p>
      )}
      <h1 className="font-display text-[30px]">Your Unsaid is ready.</h1>
      <p className="text-[var(--color-ink)]/75">
        You both answered all 96 questions independently.
      </p>
      <p className="font-display text-[24px] text-[var(--color-wine)]">
        Unsaid found: {r.conversationCount} conversations worth having
      </p>
      <p className="max-w-[440px] text-sm text-[var(--color-ink)]/70">
        Some differences are small. Some matter a lot. Neither person&rsquo;s private
        answers will be shown. See what you&rsquo;ve left unsaid.
      </p>
      <p className="text-[var(--color-ink)]/60">Detailed results remain locked.</p>

      <div className="rounded-[18px] border border-[var(--color-warm-gray)] bg-white p-6">
        <p className="font-semibold">Unlock for both · $29</p>
        <p className="text-sm text-[var(--color-ink)]/60">One payment. No subscription.</p>
      </div>

      {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}

      <Button onClick={startCheckout} disabled={checkoutLoading}>
        {checkoutLoading ? "Redirecting…" : "See our Unsaid"}
      </Button>
    </div>
  );
}
