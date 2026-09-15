import { track } from "@/lib/analytics";
import { requireCheckContext } from "@/lib/checks";
import { handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";
import { resultsPayload } from "@/lib/results";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ checkId: string }> };

/** GET /api/results/:checkId — API_CONTRACT §4. List rows never carry answers. */
export const GET = handler(async (_request: Request, { params }: Params) => {
  const { checkId } = await params;
  const profile = await currentProfile();
  const { check, participants, you } = await requireCheckContext(checkId, profile.id);

  const payload = await resultsPayload(check, participants);

  await track("results_viewed", {
    profileId: profile.id,
    checkId: check.id,
    role: you.role,
  });

  return Response.json(payload);
});
