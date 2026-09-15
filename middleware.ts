import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Public paths — API_CONTRACT §2.
 *
 * `/invite/[^/]+$` matches the token page only: `/invite/continue` stays
 * auth-required (E2E_LOCKS §3).
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/questions-before-marriage(.*)",
  "/premarital-questions(.*)",
  "/before-you-get-married(.*)",
  "/marriage-expectations(.*)",
  "/money-conversations-before-marriage(.*)",
  "/children-conversations-before-marriage(.*)",
  "/premarital-counseling-alternative(.*)",
  "/faith-and-marriage(.*)",
  "/money-before-marriage(.*)",
  "/premarital-compatibility(.*)",
  "/questions-about-kids-before-marriage(.*)",
  "/questions-for-engaged-couples(.*)",
  "/sex-before-marriage-conversations(.*)",
  "/api/stripe/webhook",
  "/api/clerk/webhook",
  "/api/health",
  "/robots.txt",
  "/sitemap.xml",
]);

/**
 * The token page and its read-only preview endpoint are public; everything
 * deeper (`/invite/continue`, `/api/invitations/:token/accept`) is not.
 */
const isPublicInviteToken = (pathname: string) =>
  (/^\/invite\/[^/]+$/.test(pathname) && pathname !== "/invite/continue") ||
  /^\/api\/invitations\/[^/]+$/.test(pathname);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  if (isPublicRoute(request) || isPublicInviteToken(pathname)) return;

  // Route Handlers answer with the contract's `UNAUTHORIZED` JSON themselves
  // (E2E_LOCKS §12), so the middleware must not swallow them into a 404.
  if (pathname.startsWith("/api/")) return;

  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });
});

export const config = {
  matcher: [
    // Skip Next internals and static files unless they appear in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
