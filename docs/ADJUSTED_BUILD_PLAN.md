# Unsaid — Adjusted Build Plan (implementation agent)

**Base:** [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)  
**Authority:** [E2E_LOCKS.md](./E2E_LOCKS.md) wins on conflict.

## Scope adjustment for this unattended run

Ship the **E2E launch path** (E2E_LOCKS §14), not every Phase 9 nice-to-have.

### In scope (must ship)

1. Next.js App Router 15+ on Netlify + design tokens + Clerk middleware public paths  
2. Full SQL migrations (DATA_MODEL) + `GET /api/health` via `@netlify/database`  
3. Scoring `shared/scoring.ts` + golden fixture tests (`algorithm_version` 1.0.0)  
4. Crypto helpers (ANSWER_MASTER_KEY AES-256-GCM DEK wrap + response encrypt)  
5. Auth OTP + onboarding profile gate + `GET/PATCH /api/me`  
6. Checks create/get/invite/accept + invite cookie handoff  
7. Assessment UI (one Q/screen, importance/hard-line, follow-ups, resume, offline queue)  
8. Calculate idempotent + ready teaser + Stripe checkout either party + webhook unlock/refund  
9. Results + reveal + discussed + retake  
10. Account export/delete + Clerk `user.deleted` webhook  
11. Landing + legal stubs + emails (Resend or log mode)  
12. Retention scheduled function stub + CI content validate + unit tests for scoring  

### Explicitly deferred (stubs OK / 404 OK)

- Full SEO long-form bodies (routes may stub)  
- PWA installability  
- `/admin` UI (middleware allowlist can exist; pages stub)  
- Sentry wiring beyond env placeholder  
- Production Netlify DB proof on live site (needs linked site + secrets; implement code path)

## Slice ownership (parallel)

| Slice | Owns | Model preference |
| --- | --- | --- |
| A Foundation | package.json, next config, app layout, tokens, middleware, Clerk provider | scaffold |
| B Schema | `netlify/database/migrations/**`, `db/` schema if used | careful SQL |
| C Scoring+crypto | `shared/scoring.ts`, `lib/crypto.ts`, vitest golden | high-precision |
| D API | `app/api/**`, `lib/db.ts`, rate limits, emails | thorough backend |
| E Marketing UI | landing, legal, sign-in chrome | design-aware |
| F Product UI | onboarding, dashboard, invite, assessment, ready, unlock, results, settings | product UI |
| G Review | bugbot + security-review after integrate | review |

## Integration rules

- E2E_LOCKS over every other doc  
- Never return partner answers unless `reveals.status = mutual`  
- Brand string always `Unsaid`  
- `requiredCount` dynamic (96 + follow-ups)  
- Unlock only via Stripe webhook  
- Use `@netlify/database` `getDatabase()` + SQL migrations (Netlify coding context). Drizzle optional; do not block on it.  
- Env via Netlify / `.env.example` — no hardcoded secrets  
- `.netlify` in `.gitignore`  

## Definition of done (this PR)

- `npm run build` succeeds with placeholder env for public keys where needed  
- Scoring golden fixtures pass  
- Content validate CI still green  
- App structure matches IMPLEMENTATION_PLAN §4 for in-scope routes  
- README updated with local run instructions  
