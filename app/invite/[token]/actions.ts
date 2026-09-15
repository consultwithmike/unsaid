"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeAuth } from "@/lib/ui-auth";

const PENDING_INVITE_COOKIE = "unsaid_pending_invite";

/**
 * Stores the raw invite token in an HttpOnly cookie (FLOWS.md §1) and hands
 * off to Clerk (signed out) or straight to `/invite/continue` (signed in),
 * which performs the actual accept against the API.
 */
export async function joinInvite(token: string) {
  const jar = await cookies();
  jar.set(PENDING_INVITE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });

  const { userId } = await safeAuth();
  if (userId) {
    redirect("/invite/continue");
  }
  redirect("/sign-in");
}
