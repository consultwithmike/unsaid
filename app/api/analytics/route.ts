import { z } from "zod";

import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
import { sql } from "@/lib/db";
import { apiError, handler } from "@/lib/errors";
import { optionalUserId } from "@/lib/auth";
import { isUuid } from "@/lib/checks";

export const dynamic = "force-dynamic";

const schema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  checkId: z.string().nullish(),
  role: z.enum(["A", "B"]).nullish(),
  sectionIndex: z.number().int().min(0).max(11).nullish(),
  source: z.string().trim().max(64).nullish(),
  value: z.number().nullish(),
});

/**
 * POST /api/analytics — first-party events from the client. Only allowlisted
 * names and opaque props are accepted (E2E_LOCKS §11).
 */
export const POST = handler(async (request: Request) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) apiError("VALIDATION", "Unsupported analytics event.");
  const body = parsed.data;

  const clerkUserId = await optionalUserId();
  let profileId: string | null = null;
  if (clerkUserId) {
    const [row] = await sql()<{ id: string }>`
      SELECT id FROM profiles WHERE clerk_user_id = ${clerkUserId}
    `;
    profileId = row?.id ?? null;
  }

  await track(body.event, {
    profileId,
    checkId: body.checkId && isUuid(body.checkId) ? body.checkId : null,
    role: body.role ?? null,
    sectionIndex: body.sectionIndex ?? null,
    source: body.source ?? null,
    value: body.value ?? null,
  });

  return new Response(null, { status: 204 });
});
