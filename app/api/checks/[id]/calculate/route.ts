import { track } from "@/lib/analytics";
import { requireCheckContext } from "@/lib/checks";
import { handler } from "@/lib/errors";
import { currentProfile } from "@/lib/profile";
import { calculateResults } from "@/lib/results";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST /api/checks/:id/calculate — idempotent on the results PK. */
export const POST = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const profile = await currentProfile();
  const { check } = await requireCheckContext(id, profile.id);

  const existed = Boolean(check.algorithm_version);
  const results = await calculateResults(check);
  if (!existed) {
    await track("check_ready", { profileId: profile.id, checkId: check.id });
  }

  return Response.json({
    checkId: check.id,
    status: check.status === "unlocked" ? "unlocked" : "ready",
    algorithmVersion: results.algorithm_version,
    questionSetVersion: results.question_set_version,
    conversationCount: results.teaser_conversation_count,
    hardLineCollisionCount: results.hard_line_collision_count,
    generatedAt: results.generated_at,
  });
});
