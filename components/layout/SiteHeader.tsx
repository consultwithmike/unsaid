import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { safeAuth } from "@/lib/auth";

export async function SiteHeader() {
  const { userId } = await safeAuth();

  return (
    <header className="border-b border-[var(--color-warm-gray)]/60">
      <div className="container-content flex h-16 items-center justify-between">
        <Wordmark />
        <nav className="flex items-center gap-4 text-sm font-medium">
          {userId ? (
            <>
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <Link href="/settings" className="hover:underline">
                Settings
              </Link>
            </>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-[14px] bg-[var(--color-wine)] px-4 py-2 text-white hover:bg-[var(--color-wine-dark)]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
