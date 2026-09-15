import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Public paths — docs/API_CONTRACT.md §2. Everything else requires auth.
 * `/invite/continue` is intentionally NOT public even though it's under
 * `/invite/*` — the matcher below only allows the token page.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/sign-in(.*)",
  "/invite/([^/]+)$",
  "/questions-before-marriage",
  "/premarital-compatibility",
  "/money-before-marriage",
  "/questions-about-kids-before-marriage",
  "/sex-before-marriage-conversations",
  "/faith-and-marriage",
  "/questions-for-engaged-couples",
  "/api/stripe/webhook",
  "/api/clerk/webhook",
  "/api/health",
]);

export default clerkMiddleware(async (authFn, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  await authFn.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
