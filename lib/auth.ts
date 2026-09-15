import { auth, currentUser } from "@clerk/nextjs/server";

import { apiError } from "./errors";

export interface ClerkIdentity {
  userId: string;
  email: string | null;
  firstName: string | null;
}

/** Clerk user id for the request, or `UNAUTHORIZED`. */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) apiError("UNAUTHORIZED");
  return userId;
}

export async function optionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * Clerk identity for the request. Email and first name are only used to seed
 * the `profiles` row — client-supplied identity fields are never trusted
 * (PRIVACY invariant 7).
 */
export async function requireIdentity(): Promise<ClerkIdentity> {
  const userId = await requireUserId();
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;
  return {
    userId,
    email: email ? email.toLowerCase() : null,
    firstName: user?.firstName ?? null,
  };
}
