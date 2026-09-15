"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiGet, apiPost } from "@/lib/api-client";
import { BAND_LABELS, CLASSIFICATION_LABELS, LEGAL_PARAGRAPH } from "@/lib/copy";
import type { ResultsResponse } from "@/lib/types";

export function ResultsSummaryClient({ checkId }: { checkId: string }) {
  const router = useRouter();
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await apiGet<ResultsResponse>(`/api/results/${checkId}`);
      if (result.ok) {
        if (result.data.status === "ready") {
          router.replace(`/checks/${checkId}/ready`);
          return;
        }
        setResults(result.data);
      } else {
        setLoadFailed(true);
      }
    })();
  }, [checkId, router]);

  async function retake() {
    setRetaking(true);
    const result = await apiPost<{ checkId: string }>(`/api/checks/${checkId}/retake`);
    setRetaking(false);
    if (result.ok) router.push(`/checks/${result.data.checkId}/ready`);
  }

  if (loadFailed) {
    return (
      <div className="container-results flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="font-display text-[26px]">We couldn&rsquo;t load your results.</h1>
      </div>
    );
  }

  if (!results || results.status !== "unlocked") {
    return <div className="container-results py-20 text-center text-[var(--color-ink)]/50">Loading…</div>;
  }

  const shareText = `You don't have to agree about everything before marriage. But you should know where you don't.\nBefore you wed. Check Unsaid.\n${typeof window !== "undefined" ? window.location.origin : ""}`;

  const sortedCategories = [...results.categoryScores].sort(
    (a, b) => a.alignmentIndex - b.alignmentIndex,
  );
  const sortedItems = [...results.items].sort((a, b) => b.impact - a.impact);

  return (
    <div className="container-results py-12">
      <p className="text-sm text-[var(--color-ink)]/60">
        Unsaid · {results.names.a} + {results.names.b}
      </p>
      <h1 className="mt-2 font-display text-[32px]">
        You have {results.counts.conversation + results.counts.major} conversations
        worth having.
      </h1>
      <p className="mt-3 max-w-[560px] text-[var(--color-ink)]/75">
        You&rsquo;re aligned on a lot. These are the places where your expectations
        deserve a real conversation before marriage.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <div className="rounded-[18px] border border-[var(--color-warm-gray)] bg-white px-6 py-4">
          <p className="text-sm text-[var(--color-ink)]/60">Alignment Index</p>
          <p className="font-display text-[36px] text-[var(--color-wine)]">
            {results.alignmentIndex}
          </p>
          <p className="text-sm">{BAND_LABELS[results.alignmentBand]}</p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <CountPill label="aligned" value={results.counts.aligned} />
          <CountPill label="small differences" value={results.counts.minor} />
          <CountPill label="conversations" value={results.counts.conversation} />
          <CountPill label="major conversation(s)" value={results.counts.major} />
        </div>
      </div>

      {results.counts.hardLineCollisions > 0 && (
        <p className="mt-4 rounded-[14px] bg-[var(--color-stone)] px-4 py-3 text-sm">
          {results.counts.hardLineCollisions} major hard-line difference(s) — counted
          separately from the Alignment Index.
        </p>
      )}

      <section className="mt-12">
        <h2 className="font-display text-[22px]">Alignment by topic</h2>
        <div className="mt-4 grid gap-3">
          {sortedCategories.map((c) => (
            <div
              key={c.sectionId}
              className="flex items-center justify-between rounded-[14px] border border-[var(--color-warm-gray)] bg-white px-4 py-3"
            >
              <span>{c.label}</span>
              <span className="font-semibold">Alignment Index {c.alignmentIndex}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-[22px]">Start with what matters most</h2>
        <div className="mt-4 grid gap-4">
          {sortedItems.map((item) => (
            <Link key={item.questionId} href={`/results/${checkId}/items/${item.questionId}`}>
              <Card className="press-scale transition-colors hover:border-[var(--color-wine)]">
                <p className="font-semibold">
                  {item.category} · {CLASSIFICATION_LABELS[item.classification]}
                </p>
                <p className="mt-1 text-[var(--color-ink)]/75">{item.neutralDescription}</p>
                <p className="mt-2 text-sm font-medium text-[var(--color-wine)]">
                  Talk about this →
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16 flex flex-col items-center gap-3 text-center">
        <Button variant="secondary" onClick={retake} disabled={retaking}>
          {retaking ? "Starting…" : "Things changed? Check again."}
        </Button>

        <p className="mt-6 font-medium">Know someone getting serious?</p>
        <Button
          variant="ghost"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ text: shareText });
                return;
              } catch {
                /* cancelled */
              }
            }
            await navigator.clipboard.writeText(shareText);
            setShared(true);
          }}
        >
          {shared ? "Copied" : "Send them Unsaid"}
        </Button>
      </section>

      <p className="mx-auto mt-16 max-w-[560px] text-center text-xs text-[var(--color-ink)]/50">
        {LEGAL_PARAGRAPH}
      </p>
    </div>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-[var(--color-warm-gray)] bg-white px-4 py-2">
      {value} {label}
    </span>
  );
}
