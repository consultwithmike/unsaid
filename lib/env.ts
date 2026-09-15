/**
 * Server-side env access.
 *
 * Next.js Route Handlers on Netlify read `process.env`; Netlify Functions
 * (`netlify/functions/**`) use `Netlify.env.get`. `readEnv` prefers the
 * Netlify global when it exists so the same helpers work in both runtimes.
 */

declare const Netlify:
  | { env: { get(key: string): string | undefined } }
  | undefined;

export function readEnv(key: string): string | undefined {
  try {
    if (typeof Netlify !== "undefined" && Netlify?.env?.get) {
      const fromNetlify = Netlify.env.get(key);
      if (fromNetlify !== undefined && fromNetlify !== "") return fromNetlify;
    }
  } catch {
    // Netlify global unavailable — fall through to process.env.
  }
  const fromProcess = process.env[key];
  return fromProcess === "" ? undefined : fromProcess;
}

export function requireEnv(key: string): string {
  const value = readEnv(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const QUESTION_SET_VERSION = "2026.09";
export const ALGORITHM_VERSION = "1.0.0";
export const PRODUCT_VERSION = "mvp-1";
export const PRICE_CENTS = 2900;
export const CURRENCY = "usd";

/** Invite TTL and inactivity retention windows (E2E_LOCKS §3, PRIVACY). */
export const INVITE_TTL_DAYS = 30;
export const INACTIVITY_EXPIRY_DAYS = 90;

export const PENDING_INVITE_COOKIE = "unsaid_pending_invite";

export function siteUrl(): string {
  const explicit = readEnv("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const deployUrl = readEnv("DEPLOY_PRIME_URL") ?? readEnv("URL");
  if (deployUrl) return deployUrl.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function adminEmails(): string[] {
  return (readEnv("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export function supportEmail(): string {
  return readEnv("SUPPORT_EMAIL") ?? "support@unsaid.app";
}
