import { sql } from "./db";
import { apiError } from "./errors";

/** Buckets and limits — E2E_LOCKS §13. */
export const RATE_LIMITS = {
  invite_create: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
  invite_replace: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
  remind: { limit: 1, windowMs: 24 * 60 * 60 * 1000 },
  checkout_create: { limit: 10, windowMs: 60 * 60 * 1000 },
  reveal_request: { limit: 30, windowMs: 24 * 60 * 60 * 1000 },
  export: { limit: 5, windowMs: 24 * 60 * 60 * 1000 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

function windowStart(windowMs: number): Date {
  return new Date(Math.floor(Date.now() / windowMs) * windowMs);
}

/**
 * Fixed-window counter. Increments first and rolls back by comparing the
 * returned count, so concurrent requests cannot both slip past the limit.
 */
export async function consumeRateLimit(
  bucket: RateLimitBucket,
  subject: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const start = windowStart(windowMs);

  const [row] = await sql()<{ count: number }>`
    INSERT INTO rate_limits (bucket, subject, window_start, count)
    VALUES (${bucket}, ${subject}, ${start.toISOString()}, 1)
    ON CONFLICT (bucket, subject, window_start) DO UPDATE
      SET count = rate_limits.count + 1
    RETURNING count
  `;

  const count = Number(row?.count ?? 1);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(start.getTime() + windowMs).toISOString(),
  };
}

export async function enforceRateLimit(
  bucket: RateLimitBucket,
  subject: string,
  message?: string,
): Promise<void> {
  const result = await consumeRateLimit(bucket, subject);
  if (!result.allowed) apiError("RATE_LIMITED", message);
}
