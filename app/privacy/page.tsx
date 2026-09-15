import { LEGAL_STUB_BODY } from "@/lib/copy";

export const metadata = { title: "Privacy — Unsaid" };

export default function PrivacyPage() {
  return (
    <div className="container-content py-16">
      <h1 className="font-display text-[32px]">Privacy</h1>
      <p className="mt-6 max-w-[560px] text-[17px] leading-[1.6] text-[var(--color-ink)]/85">
        {LEGAL_STUB_BODY}
      </p>
    </div>
  );
}
