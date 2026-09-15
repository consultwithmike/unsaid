"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { apiGet, apiPost } from "@/lib/api-client";
import { CLASSIFICATION_LABELS } from "@/lib/copy";
import type { ResultItemDetail } from "@/lib/types";

export function ResultItemClient({
  checkId,
  questionId,
}: {
  checkId: string;
  questionId: string;
}) {
  const [item, setItem] = useState<ResultItemDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showOwnAnswer, setShowOwnAnswer] = useState(false);
  const [ownAnswer, setOwnAnswer] = useState<ResultItemDetail["ownAnswer"] | null>(null);
  const [requestingReveal, setRequestingReveal] = useState(false);
  const [revealRequested, setRevealRequested] = useState(false);
  const [markingDiscussed, setMarkingDiscussed] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await apiGet<ResultItemDetail>(
        `/api/results/${checkId}/items/${questionId}`,
      );
      if (result.ok) {
        setItem(result.data);
      } else {
        setLoadFailed(true);
      }
    })();
  }, [checkId, questionId]);

  async function loadOwnAnswer() {
    if (ownAnswer !== null) {
      setShowOwnAnswer((v) => !v);
      return;
    }
    const result = await apiGet<ResultItemDetail>(
      `/api/results/${checkId}/items/${questionId}?include=own`,
    );
    if (result.ok) {
      setOwnAnswer(result.data.ownAnswer ?? null);
      setShowOwnAnswer(true);
    }
  }

  async function requestReveal() {
    if (!confirm("Revealing cannot be undone. Request mutual reveal?")) return;
    setRequestingReveal(true);
    const result = await apiPost(`/api/results/${checkId}/items/${questionId}/reveal`);
    setRequestingReveal(false);
    if (result.ok) setRevealRequested(true);
  }

  async function markDiscussed() {
    setMarkingDiscussed(true);
    const result = await apiPost(`/api/results/${checkId}/items/${questionId}/discussed`);
    setMarkingDiscussed(false);
    if (result.ok && item) {
      setItem({ ...item, discussedAt: new Date().toISOString() });
    }
  }

  if (loadFailed) {
    return (
      <div className="container-content flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="font-display text-[24px]">We couldn&rsquo;t load this conversation.</h1>
        <Link href={`/results/${checkId}`} className="text-[var(--color-wine)] underline">
          Back to results
        </Link>
      </div>
    );
  }

  if (!item) {
    return <div className="container-content py-20 text-center text-[var(--color-ink)]/50">Loading…</div>;
  }

  const isMutual = item.revealStatus === "mutual";

  return (
    <div className="container-content py-12">
      <Link href={`/results/${checkId}`} className="text-sm text-[var(--color-wine)] underline">
        ← Back to results
      </Link>

      <h1 className="mt-4 font-display text-[28px]">
        {item.category} · {CLASSIFICATION_LABELS[item.classification]}
      </h1>
      <p className="mt-3 text-[var(--color-ink)]/80">{item.neutralDescription}</p>

      {item.hardLineCollision && (
        <p className="mt-3 rounded-[14px] bg-[var(--color-stone)] px-4 py-3 text-sm">
          This is a major difference, and at least one of you considers this especially
          important.
        </p>
      )}

      {!isMutual && (
        <p className="mt-3 text-sm text-[var(--color-ink)]/60">
          Neither person&rsquo;s private answer has been revealed.
        </p>
      )}

      {isMutual && item.ownAnswer !== undefined && item.partnerAnswer !== undefined ? (
        <div className="mt-4 rounded-[14px] border border-[var(--color-warm-gray)] bg-white p-4 text-sm">
          <p>You: {formatAnswer(item.ownAnswer)}</p>
          <p>Partner: {formatAnswer(item.partnerAnswer)}</p>
        </div>
      ) : (
        <button
          onClick={loadOwnAnswer}
          className="mt-4 text-sm font-medium text-[var(--color-wine)] underline"
        >
          {showOwnAnswer ? "Hide my answer" : "See my answer"}
        </button>
      )}
      {showOwnAnswer && !isMutual && (
        <p className="mt-2 text-sm">You: {formatAnswer(ownAnswer)}</p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-[20px]">Talk about</h2>
        <ul className="mt-3 grid gap-2 text-[var(--color-ink)]/80">
          {item.prompts.map((p) => (
            <li key={p} className="rounded-[14px] bg-[var(--color-stone)] px-4 py-3">
              {p}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        {!isMutual && (
          <Button
            variant="secondary"
            onClick={requestReveal}
            disabled={requestingReveal || revealRequested}
          >
            {revealRequested ? "Reveal requested" : "Request mutual reveal"}
          </Button>
        )}
        <Button
          variant={item.discussedAt ? "ghost" : "primary"}
          onClick={markDiscussed}
          disabled={markingDiscussed || !!item.discussedAt}
        >
          {item.discussedAt ? "Marked as discussed" : "Mark discussed"}
        </Button>
      </div>

      {revealRequested && !isMutual && (
        <p className="mt-4 max-w-[480px] text-sm text-[var(--color-ink)]/60">
          Your answer will not be revealed unless your partner independently agrees to
          reveal theirs.
        </p>
      )}
    </div>
  );
}

function formatAnswer(answer: ResultItemDetail["ownAnswer"] | null | undefined) {
  if (answer === null || answer === undefined) return "—";
  // Defensive: some payloads may wrap as `{ answer: ... }`.
  if (typeof answer === "object" && !Array.isArray(answer) && answer !== null && "answer" in answer) {
    return formatAnswer((answer as { answer: ResultItemDetail["ownAnswer"] }).answer);
  }
  if (Array.isArray(answer)) return answer.join(", ");
  return String(answer);
}
