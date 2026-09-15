import type { ApiErrorBody } from "./types";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorBody; status: number };

/**
 * Thin same-origin fetch wrapper. Because app/api/** is owned by another
 * slice and may not exist yet, every call degrades gracefully: network
 * failures and non-JSON 404s surface as a typed error instead of throwing,
 * so pages can render helpful empty/error states instead of crashing.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "same-origin",
    });

    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        error: {
          code: "NOT_IMPLEMENTED",
          message: "This part of Unsaid isn't available yet.",
        },
      };
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const err = (body as ApiErrorBody) ?? {
        code: "NOT_IMPLEMENTED",
        message: "Something went wrong. Please try again.",
      };
      return { ok: false, status: res.status, error: err };
    }

    return { ok: true, data: body as T };
  } catch {
    return {
      ok: false,
      status: 0,
      error: {
        code: "NETWORK_ERROR",
        message: "You're offline, or Unsaid couldn't be reached.",
      },
    };
  }
}

export function apiGet<T>(path: string) {
  return apiFetch<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}
