"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiPatch } from "@/lib/api-client";
import { ERROR_COPY } from "@/lib/copy";
import type { MeResponse } from "@/lib/types";

export function OnboardingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [firstName, setFirstName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !ageConfirmed) {
      setError(ERROR_COPY.PROFILE_INCOMPLETE);
      return;
    }
    setSubmitting(true);
    const result = await apiPatch<MeResponse>("/api/me", {
      firstName: firstName.trim(),
      preferredName: preferredName.trim() || undefined,
      pronouns: pronouns.trim() || undefined,
      ageConfirmed18: ageConfirmed,
    });
    setSubmitting(false);

    if (result.ok) {
      router.push(next);
      return;
    }

    if (result.error.code === "NOT_IMPLEMENTED" || result.error.code === "NETWORK_ERROR") {
      setNotice(ERROR_COPY.NOT_IMPLEMENTED);
      router.push(next);
      return;
    }

    setError(ERROR_COPY[result.error.code] ?? result.error.message);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-[420px]">
      <h1 className="font-display text-[30px]">What should we call you?</h1>

      <div className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">First name</span>
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="min-h-[52px] rounded-[14px] border border-[var(--color-warm-gray)] bg-white px-4 text-[16px]"
            placeholder="Michael"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Preferred name (optional)</span>
          <input
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            className="min-h-[52px] rounded-[14px] border border-[var(--color-warm-gray)] bg-white px-4 text-[16px]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Pronouns (optional)</span>
          <input
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            className="min-h-[52px] rounded-[14px] border border-[var(--color-warm-gray)] bg-white px-4 text-[16px]"
          />
        </label>

        <label className="flex items-start gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="mt-1 h-5 w-5 accent-[var(--color-wine)]"
          />
          <span>I confirm I am 18 or older.</span>
        </label>

        {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}
        {notice && <p className="text-sm text-[var(--color-ink)]/60">{notice}</p>}

        <Button type="submit" disabled={submitting} fullWidth>
          {submitting ? "Saving…" : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}
