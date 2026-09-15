"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { apiPost } from "@/lib/api-client";
import { ERROR_COPY, RELATIONSHIP_STAGE_OPTIONS } from "@/lib/copy";
import type { CreateCheckResponse, RelationshipStage } from "@/lib/types";

export function CheckNewClient() {
  const router = useRouter();
  const [stage, setStage] = useState<RelationshipStage>("engaged");
  const [weddingDate, setWeddingDate] = useState("");
  const [partnerFirstName, setPartnerFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateCheckResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!partnerFirstName.trim()) {
      setError("Tell us your partner's first name.");
      return;
    }
    setSubmitting(true);
    const result = await apiPost<CreateCheckResponse>("/api/checks", {
      relationshipStage: stage,
      weddingDate: weddingDate || null,
      partnerFirstName: partnerFirstName.trim(),
    });
    setSubmitting(false);

    if (result.ok) {
      setCreated(result.data);
      return;
    }

    if (result.error.code === "PROFILE_INCOMPLETE") {
      router.push(`/onboarding?next=${encodeURIComponent("/checks/new")}`);
      return;
    }

    setError(ERROR_COPY[result.error.code] ?? result.error.message);
  }

  if (created) {
    const shareText = `Before we wed, I want us to Check Unsaid together.\nAnswer privately and we'll see what conversations we should have before marriage.\n${created.inviteUrl}`;
    return (
      <div className="mx-auto max-w-[480px] text-center">
        <h1 className="font-display text-[30px]">
          Now invite {partnerFirstName.trim()}.
        </h1>
        <p className="mt-4 text-[var(--color-ink)]/75">
          Your answers stay private. {partnerFirstName.trim()} will answer the same
          questions independently. Neither of you will see the other&rsquo;s
          individual answers unless you both choose to reveal one later.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ text: shareText, url: created.inviteUrl });
                  return;
                } catch {
                  /* user cancelled share sheet */
                }
              }
              await navigator.clipboard.writeText(shareText);
              setCopied(true);
            }}
            fullWidth
          >
            Share invitation
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={async () => {
              await navigator.clipboard.writeText(created.inviteUrl);
              setCopied(true);
            }}
          >
            Copy private link
          </Button>
          {copied && (
            <p className="text-sm text-[var(--color-sage)]">Copied to clipboard.</p>
          )}
        </div>

        <LinkButton
          href={`/assessment/${created.checkId}`}
          variant="ghost"
          className="mt-8 inline-block"
        >
          Start answering while you wait →
        </LinkButton>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-[480px]">
      <h1 className="font-display text-[30px]">Check Unsaid together</h1>

      <fieldset className="mt-8">
        <legend className="text-sm font-medium">What stage are you in?</legend>
        <div className="mt-3 grid gap-2">
          {RELATIONSHIP_STAGE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[14px] border px-4 ${
                stage === opt.value
                  ? "border-[var(--color-wine)] bg-[var(--color-stone)]"
                  : "border-[var(--color-warm-gray)]"
              }`}
            >
              <input
                type="radio"
                name="stage"
                value={opt.value}
                checked={stage === opt.value}
                onChange={() => setStage(opt.value as RelationshipStage)}
                className="accent-[var(--color-wine)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-6 flex flex-col gap-2">
        <span className="text-sm font-medium">Wedding date (optional)</span>
        <input
          type="date"
          value={weddingDate}
          onChange={(e) => setWeddingDate(e.target.value)}
          className="min-h-[52px] rounded-[14px] border border-[var(--color-warm-gray)] bg-white px-4 text-[16px]"
        />
      </label>

      <label className="mt-6 flex flex-col gap-2">
        <span className="text-sm font-medium">Who are you checking with?</span>
        <input
          required
          value={partnerFirstName}
          onChange={(e) => setPartnerFirstName(e.target.value)}
          placeholder="Partner first name"
          className="min-h-[52px] rounded-[14px] border border-[var(--color-warm-gray)] bg-white px-4 text-[16px]"
        />
      </label>

      {error && <p className="mt-4 text-sm text-[var(--color-brick)]">{error}</p>}

      <Button type="submit" disabled={submitting} fullWidth className="mt-8">
        {submitting ? "Creating…" : "Create our check"}
      </Button>
    </form>
  );
}
