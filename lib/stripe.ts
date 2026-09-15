import Stripe from "stripe";

import { readEnv, requireEnv } from "./env";

let client: Stripe | undefined;

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2025-02-24.acacia",
      appInfo: { name: "Unsaid" },
    });
  }
  return client;
}

export function stripePriceId(): string {
  return requireEnv("STRIPE_PRICE_ID");
}

export function stripeWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

export function stripeConfigured(): boolean {
  return Boolean(readEnv("STRIPE_SECRET_KEY") && readEnv("STRIPE_PRICE_ID"));
}
