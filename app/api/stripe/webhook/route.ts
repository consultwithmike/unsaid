import type Stripe from "stripe";

import { track } from "@/lib/analytics";
import {
  applyCheckoutCompleted,
  applyRefund,
  applySessionExpired,
} from "@/lib/payments";
import { stripe, stripeWebhookSecret } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook — public, Stripe signature only.
 *
 * This is the ONLY place a check becomes `unlocked` (E2E_LOCKS §7).
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ code: "VALIDATION", message: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      payload,
      signature,
      stripeWebhookSecret(),
    );
  } catch (error) {
    console.error("[stripe:webhook] signature verification failed", error);
    return Response.json(
      { code: "VALIDATION", message: "Invalid signature." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await applyCheckoutCompleted(session);
        const checkId = session.metadata?.checkId ?? session.client_reference_id;
        if (checkId) {
          await track("checkout_completed", {
            checkId,
            value: session.amount_total ?? null,
          });
        }
        break;
      }
      case "checkout.session.expired": {
        await applySessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "charge.refunded": {
        await applyRefund(event.data.object as Stripe.Charge);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // Returning 500 lets Stripe retry the delivery.
    console.error(`[stripe:webhook] handler failed for ${event.type}`, error);
    return Response.json({ received: false }, { status: 500 });
  }

  return Response.json({ received: true });
}
