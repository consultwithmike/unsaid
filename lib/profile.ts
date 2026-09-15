import { requireIdentity } from "./auth";
import { sql } from "./db";
import { apiError } from "./errors";

export interface ProfileRow {
  id: string;
  clerk_user_id: string;
  email: string;
  first_name: string;
  preferred_name: string | null;
  pronouns: string | null;
  age_confirmed_18: boolean;
  created_at: string;
  deleted_at: string | null;
}

export function isComplete(profile: ProfileRow): boolean {
  return profile.first_name.trim().length > 0 && profile.age_confirmed_18 === true;
}

/**
 * Upserts the `profiles` row for the authenticated Clerk user. Called on every
 * authenticated API request so a profile always exists after first sign-in.
 */
export async function currentProfile(): Promise<ProfileRow> {
  const identity = await requireIdentity();
  const email = identity.email ?? `${identity.userId}@users.noreply.unsaid.app`;
  const firstName = (identity.firstName ?? "").trim();

  const [profile] = await sql()<ProfileRow>`
    INSERT INTO profiles (clerk_user_id, email, first_name)
    VALUES (${identity.userId}, ${email}, ${firstName})
    ON CONFLICT (clerk_user_id) DO UPDATE
      SET email = EXCLUDED.email,
          updated_at = now()
    RETURNING id, clerk_user_id, email, first_name, preferred_name, pronouns,
              age_confirmed_18, created_at, deleted_at
  `;

  if (!profile) apiError("UNAUTHORIZED");
  if (profile.deleted_at) apiError("UNAUTHORIZED", "This account has been deleted.");
  return profile;
}

/** Profile gate for create-check and invitation accept (API_CONTRACT §3). */
export async function requireCompleteProfile(): Promise<ProfileRow> {
  const profile = await currentProfile();
  if (!isComplete(profile)) apiError("PROFILE_INCOMPLETE");
  return profile;
}

export function serializeProfile(profile: ProfileRow) {
  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name || null,
    preferredName: profile.preferred_name,
    pronouns: profile.pronouns,
    ageConfirmed18: profile.age_confirmed_18,
    createdAt: profile.created_at,
  };
}
