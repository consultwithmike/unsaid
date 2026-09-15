import { z } from "zod";

import { sql } from "@/lib/db";
import { apiError, handler } from "@/lib/errors";
import {
  currentProfile,
  isComplete,
  serializeProfile,
  type ProfileRow,
} from "@/lib/profile";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const profile = await currentProfile();
  return Response.json({
    profile: serializeProfile(profile),
    complete: isComplete(profile),
  });
});

const patchSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  preferredName: z.string().trim().max(80).nullish(),
  pronouns: z.string().trim().max(40).nullish(),
  ageConfirmed18: z.boolean().optional(),
});

export const PATCH = handler(async (request: Request) => {
  const profile = await currentProfile();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) apiError("VALIDATION", "Check the fields and try again.");
  const body = parsed.data;

  if (body.ageConfirmed18 === false && profile.age_confirmed_18) {
    apiError("VALIDATION", "Age confirmation cannot be withdrawn here.");
  }

  const [updated] = await sql()<ProfileRow>`
    UPDATE profiles
       SET first_name = COALESCE(${body.firstName ?? null}, first_name),
           preferred_name = COALESCE(${body.preferredName ?? null}, preferred_name),
           pronouns = COALESCE(${body.pronouns ?? null}, pronouns),
           age_confirmed_18 = COALESCE(${body.ageConfirmed18 ?? null}, age_confirmed_18),
           updated_at = now()
     WHERE id = ${profile.id}
    RETURNING id, clerk_user_id, email, first_name, preferred_name, pronouns,
              age_confirmed_18, created_at, deleted_at
  `;

  return Response.json({
    profile: serializeProfile(updated),
    complete: isComplete(updated),
  });
});
