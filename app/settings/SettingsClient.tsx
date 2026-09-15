"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiDelete } from "@/lib/api-client";
import { SUPPORT_EMAIL } from "@/lib/copy";

export function SettingsClient() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  async function downloadExport() {
    setExporting(true);
    setExportNotice(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        setExportNotice(
          res.status === 404
            ? "Export isn't available yet. Check back soon."
            : "We couldn't start your export. Please try again.",
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "unsaid-export.json";
      a.click();
      URL.revokeObjectURL(url);
      setExportNotice(
        "Your export is downloading. It includes only your information and your answers—not your partner's.",
      );
    } catch {
      setExportNotice("You're offline, or Unsaid couldn't be reached.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (confirmText !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }
    setDeleting(true);
    setError(null);
    const result = await apiDelete("/api/account");
    setDeleting(false);
    if (result.ok) {
      router.push("/");
    } else if (result.error.code === "NOT_IMPLEMENTED") {
      setError("Account deletion isn't available yet. Check back soon.");
    } else {
      setError(result.error.message);
    }
  }

  return (
    <div className="mx-auto flex max-w-[520px] flex-col gap-8">
      <h1 className="font-display text-[30px]">Settings</h1>

      <Card>
        <h2 className="font-semibold">Download my data</h2>
        <p className="mt-2 text-sm text-[var(--color-ink)]/70">
          Export includes only your information and your answers—not your partner&rsquo;s.
        </p>
        <Button variant="secondary" onClick={downloadExport} disabled={exporting} className="mt-4">
          {exporting ? "Preparing…" : "Download my data"}
        </Button>
        {exportNotice && (
          <p className="mt-3 text-sm text-[var(--color-ink)]/60">{exportNotice}</p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Contact support</h2>
        <p className="mt-2 text-sm text-[var(--color-ink)]/70">
          Questions? <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
        </p>
      </Card>

      <Card className="border-[var(--color-brick)]/40">
        <h2 className="font-semibold text-[var(--color-brick)]">Delete my account</h2>
        <p className="mt-2 text-sm text-[var(--color-ink)]/70">
          Deleting removes your account, personal identifiers, assessment answers,
          active invitations, and accessible results. If you delete a shared check, it
          becomes unavailable to both of you.
        </p>
        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-medium">Type DELETE to confirm</span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="min-h-[52px] rounded-[14px] border border-[var(--color-warm-gray)] bg-white px-4 text-[16px]"
          />
        </label>
        {error && <p className="mt-2 text-sm text-[var(--color-brick)]">{error}</p>}
        <button
          onClick={deleteAccount}
          disabled={deleting}
          className="press-scale mt-4 min-h-[52px] w-full rounded-[14px] bg-[var(--color-brick)] px-6 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete forever"}
        </button>
      </Card>
    </div>
  );
}
