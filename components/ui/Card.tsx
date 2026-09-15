import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] border border-[var(--color-warm-gray)] bg-[var(--color-white)] p-6 ${className}`}
    >
      {children}
    </div>
  );
}
