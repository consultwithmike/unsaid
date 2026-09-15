"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiDelete, apiGet } from "@/lib/api-client";
import type { DashboardCheckRow } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  awaiting_partner: "Waiting on partner",
  active: "In progress",
  ready: "Ready to unlock",
  unlocked: "Unlocked",
  expired: "Expired",
  deleted: "Deleted",
};

export function DashboardClient() {
  const [checks, setChecks] = useState<DashboardCheckRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await apiGet<{ checks: DashboardCheckRow[] }>("/api/checks");
      if (result.ok) {
        setChecks(result.data.checks);
      } else {
        setChecks([]);
        setLoadError(result.error.code !== "NOT_IMPLEMENTED");
      }
    })();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this check? This can't be undone for either of you.")) return;
    setDeletingId(id);
    const result = await apiDelete(`/api/checks/${id}`);
    setDeletingId(null);
    if (result.ok) {
      setChecks((prev) => prev?.filter((c) => c.id !== id) ?? []);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[32px]">Your Unsaid</h1>
        <LinkButton href="/checks/new" variant="primary">
          Start a check
        </LinkButton>
      </div>

      {loadError && (
        <p className="mt-4 text-sm text-[var(--color-brick)]">
          We couldn&rsquo;t load your checks. Try refreshing.
        </p>
      )}

      {checks === null ? (
        <p className="mt-8 text-[var(--color-ink)]/60">Loading…</p>
      ) : checks.length === 0 ? (
        <Card className="mt-8 text-center">
          <p className="text-[var(--color-ink)]/70">
            You haven&rsquo;t started a check yet.
          </p>
          <div className="mt-4 flex justify-center">
            <LinkButton href="/checks/new">Start your check</LinkButton>
          </div>
        </Card>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {checks.map((check) => (
            <li key={check.id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {check.nameA}
                    {check.nameB ? ` + ${check.nameB}` : ""}
                  </p>
                  <p className="text-sm text-[var(--color-ink)]/60">
                    {STATUS_LABEL[check.status] ?? check.status} ·{" "}
                    {new Date(check.createdAt).toLocaleDateString()}
                    {check.alignmentIndex !== null && (
                      <> · Alignment Index {check.alignmentIndex}</>
                    )}
                    {check.conversationCount !== null && (
                      <> · {check.conversationCount} conversations</>
                    )}
                  </p>
                </div>
                <div className="flex gap-3">
                  <LinkButton
                    href={
                      check.status === "unlocked" || check.status === "ready"
                        ? `/results/${check.id}`
                        : check.status === "active" || check.status === "awaiting_partner"
                          ? `/assessment/${check.id}`
                          : `/results/${check.id}`
                    }
                    variant="secondary"
                  >
                    View results
                  </LinkButton>
                  <button
                    onClick={() => handleDelete(check.id)}
                    disabled={deletingId === check.id}
                    className="text-sm text-[var(--color-brick)] hover:underline disabled:opacity-50"
                  >
                    Delete this check
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm text-[var(--color-ink)]/50">
        No partner swap. New comparison = new $29 check.
      </p>
    </div>
  );
}
