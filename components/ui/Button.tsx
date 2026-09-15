import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "press-scale inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-6 text-[16px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--color-wine)] text-white hover:bg-[var(--color-wine-dark)]",
  secondary:
    "border border-[var(--color-warm-gray)] bg-transparent text-[var(--color-ink)] hover:border-[var(--color-wine)]",
  ghost: "text-[var(--color-wine)] hover:underline",
};

interface CommonProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  children,
  className = "",
  fullWidth,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  children,
  className = "",
  fullWidth,
  target,
}: CommonProps & { href: string; target?: string }) {
  return (
    <Link
      href={href}
      target={target}
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}
