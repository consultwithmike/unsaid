/** API error codes and their HTTP statuses — E2E_LOCKS §12. */

export const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PROFILE_INCOMPLETE: 403,
  NOT_FOUND: 404,
  INVITE_EXPIRED: 410,
  INVITE_LOCKED: 409,
  SELF_JOIN: 403,
  CHECK_STATE: 409,
  VALIDATION: 400,
  FOLLOW_UP_REQUIRED: 400,
  OFFLINE_QUEUE_NONEMPTY: 409,
  RATE_LIMITED: 429,
  PAYMENT_REQUIRED: 402,
  CONFLICT: 409,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Sign in to continue.",
  FORBIDDEN: "You do not have access to this.",
  PROFILE_INCOMPLETE: "Finish setting up your profile first.",
  NOT_FOUND: "Not found.",
  INVITE_EXPIRED: "This invitation link has expired.",
  INVITE_LOCKED: "Your partner has already started answering.",
  SELF_JOIN: "You cannot accept your own invitation.",
  CHECK_STATE: "This check is not in the right state for that.",
  VALIDATION: "Something in that request was not valid.",
  FOLLOW_UP_REQUIRED: "A follow-up question still needs an answer.",
  OFFLINE_QUEUE_NONEMPTY: "Some answers have not finished saving yet.",
  RATE_LIMITED: "Too many attempts. Try again later.",
  PAYMENT_REQUIRED: "This check has not been unlocked yet.",
  CONFLICT: "That conflicts with the current state.",
  INTERNAL: "Something went wrong.",
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

export function apiError(
  code: ErrorCode,
  message?: string,
  details?: unknown,
): never {
  throw new ApiError(code, message, details);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { code: error.code, message: error.message },
      { status: error.status },
    );
  }
  console.error("[api] unhandled error", error);
  return Response.json(
    { code: "INTERNAL", message: DEFAULT_MESSAGES.INTERNAL },
    { status: 500 },
  );
}

/** Wraps a Route Handler so thrown ApiErrors become contract-shaped JSON. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
