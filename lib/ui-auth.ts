import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Optional-auth helper for UI chrome (header, invite handoff) that must
 * render sensibly whether or not the visitor is signed in, and must not
 * throw if `clerkMiddleware()` hasn't run yet for this request. Route
 * handlers that require auth should use `requireUserId()` in `lib/auth.ts`
 * instead — this file is UI-only.
 */
export async function safeAuth(): Promise<{ userId: string | null }> {
  try {
    const { userId } = await auth();
    return { userId: userId ?? null };
  } catch {
    return { userId: null };
  }
}

export async function safeCurrentUser() {
  try {
    return await currentUser();
  } catch {
    return null;
  }
}
