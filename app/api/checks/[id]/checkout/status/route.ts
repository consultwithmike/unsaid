import { requireCheckContext } from "@/lib/checks";
import { apiError, handler } from "@/lib/errors";
import { findPaymentBySession } from "@/lib/payments";
import { currentProfile } from "@/lib/profile";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/checks/:id/checkout/status?session_id=
 *
 * Verifies the Stripe session for the confirming UI. This route NEVER unlocks
 * a check — unlock happens only in the `checkout.session.completed` webhook
 * (E2E_LOCKS §7).
 */
export const GET = handler(async (request: Request, { params }: Params) => {
  const { id } = await params;
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) apiError("VALIDATION", "session_id is required.");

  const profile = await currentProfile();
  const { check } = await requireCheckContext(id, profile.id);

  const payment = await findPaymentBySession(sessionId);
  if (payment && payment.check_id !== check.id) apiError("FORBIDDEN");

  let stripeStatus: string | null = null;
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.checkId && session.metadata.checkId !== check.id) {
      apiError("FORBIDDEN");
    }
    stripeStatus = session.payment_status ?? session.status ?? null;
  } catch (error) {
    console.warn("[checkout:status] stripe lookup failed", error);
  }

  return Response.json({
    stripeStatus,
    checkStatus: check.status,
    paymentStatus: check.payment_status,
  });
});
