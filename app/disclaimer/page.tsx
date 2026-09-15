import { LEGAL_PARAGRAPH } from "@/lib/copy";

export const metadata = { title: "Disclaimer — Unsaid" };

export default function DisclaimerPage() {
  return (
    <div className="container-content py-16">
      <h1 className="font-display text-[32px]">Disclaimer</h1>
      <p className="mt-6 max-w-[560px] text-[17px] leading-[1.6] text-[var(--color-ink)]/85">
        {LEGAL_PARAGRAPH}
      </p>
    </div>
  );
}
