import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string | null }) {
  const content = (
    <span className="font-display text-[22px] font-semibold tracking-tight text-[var(--color-wine)]">
      Unsaid
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} aria-label="Unsaid home">
      {content}
    </Link>
  );
}
