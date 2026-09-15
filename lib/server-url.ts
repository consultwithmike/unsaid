import { headers } from "next/headers";

/** Best-effort absolute origin for server-side same-origin API calls. */
export async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() unavailable outside request scope
  }
  return "http://localhost:3000";
}
