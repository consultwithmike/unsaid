import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/copy";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-warm-gray)] py-10">
      <div className="container-content flex flex-col items-center gap-4 text-center text-sm text-[var(--color-ink)]/70">
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
          <Link href="/disclaimer" className="hover:underline">
            Disclaimer
          </Link>
        </div>
        <p>
          Questions?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="font-display text-[var(--color-wine)]">
          Before you wed. Check Unsaid.
        </p>
      </div>
    </footer>
  );
}
