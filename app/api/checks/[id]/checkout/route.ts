import { track } from "@/lib/analytics";
import { requireCheckContext } from "@/lib/checks";
import { CURRENCY, PRICE_CENTS } from "@/lib/env";
import { apiError, handler } from "@/lib/errors";
import { createOrReuseCheckout } from "@/lib/payments";
import { currentProfile } from "@/lib/profile";
import { enforceRateLimit } from "@/lib/rate-limit";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST /api/checks/:id/checkout — either participant may pay (E2E_LOCKS §7). */
export const POST = handler(async (_request: Request, { params }: Params) => {
  const { id } = await params;
  const profile = await currentProfile();
  const { check, you } = await requireCheckContext(id, profile.id);

  if (!stripeConfigured()) {
    apiError("CONFLICT", "Payments are not configured for this environment.");
  }

  await enforceRateLimit("checkout_create", check.id);

  const { url, reused } = await createOrReuseCheckout(check, profile.clerk_user_id);

  if (!reused) {
    await track("checkout_started", {
      profileId: profile.id,
      checkId: check.id,
      role: you.role,
      value: PRICE_CENTS,
    });
  }

  return Response.json({
    // `url` and `checkoutUrl` are the same value; both names are in use by callers.
    url,
    checkoutUrl: url,
    reused,
    priceCents: PRICE_CENTS,
    currency: CURRENCY,
  });
});
