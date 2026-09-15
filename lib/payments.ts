import type Stripe from "stripe";

import { sql, withTransaction } from "./db";
import { apiError } from "./errors";
import { CURRENCY, PRICE_CENTS, PRODUCT_VERSION, siteUrl } from "./env";
import { stripe, stripePriceId } from "./stripe";
import type { CheckRow } from "./checks";

export type PaymentRowStatus = "open" | "paid" | "refunded" | "expired";

export interface PaymentRow {
  id: string;
  check_id: string;
  purchasing_clerk_user_id: string;
  stripe_checkout_session: string | null;
  stripe_payment_intent: string | null;
  amount: number;
  currency: string;
  status: PaymentRowStatus;
  product_version: string | null;
  session_expires_at: string | null;
  checkout_url: string | null;
  created_at: string;
}

export async function findActivePayment(checkId: string): Promise<PaymentRow | null> {
  const rows = await sql()<PaymentRow>`
    SELECT id, check_id, purchasing_clerk_user_id, stripe_checkout_session,
           stripe_payment_intent, amount, currency, status, product_version,
           session_expires_at, checkout_url, created_at
      FROM payments
     WHERE check_id = ${checkId}
       AND status IN ('open', 'paid')
     ORDER BY created_at DESC
     LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findPaymentBySession(
  sessionId: string,
): Promise<PaymentRow | null> {
  const rows = await sql()<PaymentRow>`
    SELECT id, check_id, purchasing_clerk_user_id, stripe_checkout_session,
           stripe_payment_intent, amount, currency, status, product_version,
           session_expires_at, checkout_url, created_at
      FROM payments
     WHERE stripe_checkout_session = ${sessionId}
  `;
  return rows[0] ?? null;
}

function sessionUnexpired(payment: PaymentRow): boolean {
  if (!payment.session_expires_at) return false;
  return new Date(payment.session_expires_at).getTime() > Date.now();
}

/**
 * Dual checkout (E2E_LOCKS §7): either participant may pay, at most one
 * `open|paid` row exists per check, and an unexpired open session is reused.
 */
export async function createOrReuseCheckout(
  check: CheckRow,
  clerkUserId: string,
): Promise<{ url: string; reused: boolean }> {
  if (check.status === "unlocked" || check.payment_status === "paid") {
    apiError("CHECK_STATE", "This check is already unlocked.");
  }
  if (check.status !== "ready") {
    apiError("CHECK_STATE", "Results are not ready yet.");
  }

  const existing = await findActivePayment(check.id);
  if (existing?.status === "paid") {
    apiError("CHECK_STATE", "This check is already paid for.");
  }
  if (existing && existing.checkout_url && sessionUnexpired(existing)) {
    return { url: existing.checkout_url, reused: true };
  }

  const priceId = stripePriceId();
  const site = siteUrl();

  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${site}/checks/${check.id}/unlock?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/checks/${check.id}/ready?checkout=cancelled`,
      client_reference_id: check.id,
      metadata: { checkId: check.id, productVersion: PRODUCT_VERSION },
    },
    { idempotencyKey: `checkout:${check.id}:${priceId}` },
  );

  if (!session.url) apiError("CONFLICT", "Stripe did not return a checkout URL.");

  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null;

  if (existing) {
    await sql()`
      UPDATE payments
         SET stripe_checkout_session = ${session.id},
             checkout_url = ${session.url},
             session_expires_at = ${expiresAt},
             purchasing_clerk_user_id = ${clerkUserId},
             amount = ${session.amount_total ?? PRICE_CENTS},
             currency = ${session.currency ?? CURRENCY},
             updated_at = now()
       WHERE id = ${existing.id}
    `;
  } else {
    await sql()`
      INSERT INTO payments (
        check_id, purchasing_clerk_user_id, stripe_checkout_session, amount,
        currency, status, product_version, session_expires_at, checkout_url
      ) VALUES (
        ${check.id}, ${clerkUserId}, ${session.id},
        ${session.amount_total ?? PRICE_CENTS}, ${session.currency ?? CURRENCY},
        'open', ${PRODUCT_VERSION}, ${expiresAt}, ${session.url}
      )
      ON CONFLICT (stripe_checkout_session) DO NOTHING
    `;
  }

  return { url: session.url, reused: false };
}

/**
 * Sole unlock path: `checkout.session.completed`. Idempotent on session id.
 * If the check is already paid via a different session, the duplicate is
 * refunded and the unlock is left alone (E2E_LOCKS §7).
 */
export async function applyCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const checkId = session.metadata?.checkId ?? session.client_reference_id;
  if (!checkId) {
    console.warn("[stripe] checkout.session.completed without checkId", session.id);
    return;
  }

  // Async payment methods can emit checkout.session.completed before funds
  // clear — never unlock unless Stripe reports the session as paid.
  if (session.payment_status !== "paid") {
    console.warn(
      "[stripe] checkout.session.completed ignored; payment_status=",
      session.payment_status,
      session.id,
    );
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const duplicate = await withTransaction(async (client) => {
    const checkRows = await client.query<{ id: string; payment_status: string }>(
      "SELECT id, payment_status FROM checks WHERE id = $1 FOR UPDATE",
      [checkId],
    );
    const check = checkRows.rows[0];
    if (!check) return false;

    const paidRows = await client.query<{ stripe_checkout_session: string | null }>(
      "SELECT stripe_checkout_session FROM payments WHERE check_id = $1 AND status = 'paid'",
      [checkId],
    );
    const alreadyPaid = paidRows.rows[0];
    if (alreadyPaid && alreadyPaid.stripe_checkout_session !== session.id) {
      return true;
    }

    await client.query(
      `INSERT INTO payments (
         check_id, purchasing_clerk_user_id, stripe_checkout_session,
         stripe_payment_intent, amount, currency, status, product_version
       ) VALUES ($1,$2,$3,$4,$5,$6,'paid',$7)
       ON CONFLICT (stripe_checkout_session) DO UPDATE
         SET status = 'paid',
             stripe_payment_intent = COALESCE(EXCLUDED.stripe_payment_intent, payments.stripe_payment_intent),
             updated_at = now()`,
      [
        checkId,
        session.metadata?.clerkUserId ?? session.customer_email ?? "stripe",
        session.id,
        paymentIntentId,
        session.amount_total ?? PRICE_CENTS,
        session.currency ?? CURRENCY,
        PRODUCT_VERSION,
      ],
    );

    await client.query(
      `UPDATE checks
          SET status = 'unlocked',
              payment_status = 'paid',
              unlocked_at = COALESCE(unlocked_at, now()),
              last_activity_at = now()
        WHERE id = $1`,
      [checkId],
    );

    return false;
  });

  if (duplicate && paymentIntentId) {
    try {
      await stripe().refunds.create(
        { payment_intent: paymentIntentId },
        { idempotencyKey: `refund-duplicate:${session.id}` },
      );
      await sql()`
        INSERT INTO payments (
          check_id, purchasing_clerk_user_id, stripe_checkout_session,
          stripe_payment_intent, amount, currency, status, product_version
        ) VALUES (
          ${checkId}, 'stripe', ${session.id}, ${paymentIntentId},
          ${session.amount_total ?? PRICE_CENTS}, ${session.currency ?? CURRENCY},
          'refunded', ${PRODUCT_VERSION}
        )
        ON CONFLICT (stripe_checkout_session) DO NOTHING
      `;
    } catch (error) {
      console.error("[stripe] duplicate refund failed", error);
    }
  }
}

/** Refund re-locks results to the teaser; result rows are retained. */
export async function applyRefund(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!paymentIntentId) return;

  const rows = await sql()<{ check_id: string }>`
    UPDATE payments
       SET status = 'refunded', updated_at = now()
     WHERE stripe_payment_intent = ${paymentIntentId}
       AND status = 'paid'
    RETURNING check_id
  `;

  for (const row of rows) {
    await sql()`
      UPDATE checks
         SET status = 'ready',
             payment_status = 'refunded',
             unlocked_at = NULL,
             last_activity_at = now()
       WHERE id = ${row.check_id}
    `;
  }
}

export async function applySessionExpired(
  session: Stripe.Checkout.Session,
): Promise<void> {
  await sql()`
    UPDATE payments
       SET status = 'expired', updated_at = now()
     WHERE stripe_checkout_session = ${session.id}
       AND status = 'open'
  `;
}

