# Unsaid — Implementation Plan

**Status:** Locked for Netlify deployment · gaps closed  
**Stack:** Next.js App Router · Netlify · Netlify Database (Postgres) · Clerk · Stripe · Resend  
**Price:** $29 per couple, one-time · no subscription  
**Tagline:** Before you wed. Check Unsaid.

**Rule:** Everything we build must deploy on Netlify.

Companion docs (do not invent copy or contracts elsewhere):

| Doc | Role |
| --- | --- |
| [COPY.md](./COPY.md) | Screens, emails, tone, errors, principles, campaign lines |
| [FLOWS.md](./FLOWS.md) | Invite handoff, profile gate, Stripe return/refund, offline queue, admin |
| [API_CONTRACT.md](./API_CONTRACT.md) | Routes, authz, ready vs unlocked, resume cursor, export |
| [DATA_MODEL.md](./DATA_MODEL.md) | Tables + migrations |
| [SCORING.md](./SCORING.md) | Algorithm 1.0.0 |
| [PRIVACY.md](./PRIVACY.md) | Invariants + export |
| [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) | Color/type lock for build |
| [SEO_BRIEFS.md](./SEO_BRIEFS.md) | Seven editorial pages |
| [EMAILS.md](./EMAILS.md) | React Email + Resend |
| [`content/questions/2026.09.json`](../content/questions/2026.09.json) | Question bank |
| [`content/fixtures/scoring-golden.json`](../content/fixtures/scoring-golden.json) | Golden scoring cases |

Engineering stubs: `.env.example`, `package.json` (Node 20), `netlify.toml`, `.github/workflows/ci.yml`.

---

## 1. Product

Private, double-blind premarital compatibility check. Two people answer the same 96 questions independently. Server compares (importance + hard lines) and surfaces **conversations worth having**—not marry/don’t-marry advice.

**Transaction moment:**

> Your Unsaid is ready.  
> You have N conversations worth having.  
> Unlock for both · $29

Product principles and tone: [COPY.md](./COPY.md) §1–2.

---

## 2. Locked technical decisions

| Layer | Choice |
| --- | --- |
| Framework | Next.js App Router 15+ (OpenNext on Netlify; do not pin plugin unless required) |
| Auth | Clerk email OTP (`@clerk/nextjs`) |
| DB | Netlify Database (`@netlify/database` + SQL migrations) |
| Answers | AES-256-GCM · server-only · own answers readable by owner |
| Payments | Stripe Checkout + signed webhook · **either participant may pay** |
| Email | Resend |
| Analytics | First-party `analytics_events` table (allowlist only) |
| Rate limits | DB-backed counters |
| Monitoring | Sentry with PII scrubbing |

**Rejected:** Vite SPA shell, Supabase Auth/Postgres, client-side scoring, third-party analytics that ingest mismatch topics.

**Hard rules:**

1. Partner answers never leave the server unless `reveals.status = mutual`.
2. Score once server-side when both complete; store `algorithm_version` + `question_set_version`.
3. Brand string always `Unsaid`.
4. Hard-line authorship never disclosed.
5. Differences are conversations, not failures.

---

## 3. Architecture

```mermaid
flowchart TB
  subgraph client [Browser]
    UI[Next.js Client Components]
    ClerkJS[Clerk session]
  end

  subgraph netlify [Netlify]
    Edge[Clerk middleware]
    RSC[Server Components]
    API[Route Handlers]
    Sched[Scheduled retention]
    DB[(Netlify Database)]
  end

  Stripe[Stripe]
  Resend[Resend]
  ClerkAPI[Clerk]

  UI --> ClerkJS
  ClerkJS --> Edge
  UI --> API
  RSC --> DB
  API --> DB
  API --> Stripe
  API --> Resend
  Edge --> ClerkAPI
  Sched --> DB
  Stripe -->|webhook public| API
  ClerkAPI -->|user.deleted webhook| API
```

**Phase 0 proof (non-negotiable):** On a real Netlify deploy, a Route Handler must successfully call `getDatabase()` from `@netlify/database` (not only a classic `netlify/functions` file). If OpenNext runtime cannot, fall back to thin Netlify Functions for DB ops—but verify before building product UI on a fantasy.

---

## 4. Repository layout

```
/
├── netlify.toml
├── middleware.ts                 # public paths per API_CONTRACT §2
├── app/
│   ├── page.tsx                  # landing
│   ├── privacy|terms|disclaimer/
│   ├── (auth)/sign-in/
│   ├── (app)/dashboard|checks|assessment|results|settings|admin/
│   ├── invite/[token]/
│   ├── questions-before-marriage/ … (7 SEO routes)
│   └── api/…                     # per API_CONTRACT
├── content/questions/2026.09.json
├── components/ · features/ · lib/ · shared/
├── netlify/database/migrations/
├── netlify/functions/retention-cleanup.mts
├── scripts/generate-question-bank.mjs
└── docs/
```

---

## 5. Design system

See [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) — intentional MVP lock (Newsreader + Inter, ivory/wine, AA contrast). Assessment: one question per screen; sticky CTA; targets ≥ 44px; browser back works; section-complete interstitial.

---

## 6. Clerk

- Email verification code only (no passwords)
- First name + 18+ in our `profiles`; optional preferred name / pronouns
- Branded custom sign-in (not generic portal chrome)
- `clerkMiddleware` with public paths from [API_CONTRACT.md](./API_CONTRACT.md) §2
- `POST /api/clerk/webhook` on `user.deleted` → same purge as account delete
- Upsert `profiles` on first authenticated request

---

## 7. Database & encryption

`npm install @netlify/database` — auto provision on `netlify dev` / deploy.  
Migrations: `netlify/database/migrations/<number>_<slug>/migration.sql`.

Schema: [DATA_MODEL.md](./DATA_MODEL.md). Includes `analytics_events`, `rate_limits`, follow-up-capable `responses`.

Crypto: per-check DEK wrapped by `ANSWER_MASTER_KEY`; encrypt `{ answer }` per question row (follow-ups are separate rows); importance + hard_line columns for scoring.

---

## 8. Product flows (locked decisions)

Full detail: [FLOWS.md](./FLOWS.md).

**Invite handoff:** HttpOnly cookie `unsaid_pending_invite` + Clerk fallback redirect → `/invite/continue`.

**Profile gate:** first name + 18+ required before create/accept; `/onboarding?next=`.

**Own answers:** Always readable by owner; partner only after mutual reveal.

**Follow-ups:** Separate bank rows `CP07F` / `MO04F` + separate response rows (never embed in parent).

**Results:** Prompts + classification by default; `categoryScores` “By topic”; section-complete interstitial in assessment.

**Paywall:** Either participant; success URL polls; unlock **only** via webhook; refunds re-lock.

**Calculate:** `FOR UPDATE` + `results.check_id` PK idempotency.

**Offline:** IndexedDB queue; block complete while non-empty.

**Admin:** `ADMIN_EMAILS` middleware allowlist; refunds via Stripe; no answer decrypt.

**Export:** `GET /api/account/export` own data JSON.

**Locale:** en-US only.

---

## 9. API

Full contract: [API_CONTRACT.md](./API_CONTRACT.md).

Must implement (were previously missing): resume cursor on `GET /api/responses`, discussed, retake, Clerk webhook, health, checkout for either participant, checkout status poll, Stripe refund webhook, account export, public Stripe webhook.

---

## 10. Phased delivery

### Phase 0 — Deployable foundation
Next.js + Clerk + Netlify Database on a **linked Netlify site**. Tokens from DESIGN_TOKENS. Migrations for profiles + health. Prove Route Handler `SELECT 1`. Wire `.env` from `.env.example`. CI green on PR. Exit: production URL health OK.

### Phase 1 — Landing + legal
COPY landing + campaign lines · `/privacy` `/terms` `/disclaimer` · support footer · analytics · LCP ~2s.

### Phase 2 — Auth + onboarding + dashboard
OTP · `/onboarding` gate · `GET/PATCH /api/me` · dashboard list · account export + delete UI.

### Phase 3 — Bank + scoring
Ship bank JSON · seed questions · `shared/scoring.ts` against **golden fixtures** · follow-up exclusion rules.

### Phase 4 — Checks + invites
Create · invite cookie handoff · accept · self-join block · partner lock · invite email · rate limits · preview Clerk URLs documented.

### Phase 5 — Assessment
Section intros + **section-complete interstitial** · importance/hard-line · follow-ups as separate POSTs · resume cursor · IndexedDB offline queue · waiting + reminder · no pre-score.

### Phase 6 — Calculate + Stripe
Idempotent calculate · ready teaser · Checkout either party · success poll page · webhook unlock + **refund re-lock** · emails.

### Phase 7 — Results + reveal
Conversations headline · Alignment Index · **By topic** category scores · impact list · own answer · mutual reveal · discussed · retake · viral share.

### Phase 8 — Trust
Clerk user.deleted · retention cron · Sentry scrub · a11y · COPY error states · support contact.

### Phase 9 — SEO + PWA + admin
SEO_BRIEFS pages · PWA shell · `/admin` with ADMIN_EMAILS · Stripe refund tool.

---

## 11. Non-goals (MVP)

AI advice, chat, therapist marketplace, wedding planning, subscriptions, social, dating matching, public scores, native apps, referral discounts, counselor SKU, compare-over-time.

---

## 12. Env

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
ANSWER_MASTER_KEY
RESEND_API_KEY
EMAIL_FROM
SENTRY_DSN
NEXT_PUBLIC_SITE_URL
ADMIN_EMAILS
```

---

## 13. Deploy checklist

1. `next build` local OK  
2. Netlify production deploy green  
3. Clerk OTP on deploy URL  
4. Migration applied  
5. Health Route Handler `getDatabase()` works **on that deploy**  
6. Stripe test Checkout + webhook  
7. Middleware: invite + webhooks public; app APIs protected  

Local: prefer `netlify dev` when testing DB.

---

## 14. Testing

| Layer | Focus |
| --- | --- |
| Unit | Distances, CP02, HL02 matrix, encryption, impact sort |
| Contract | Authz matrix, ready vs unlocked shapes, reveal machine, self-join |
| Deploy smoke | Health + Clerk + DB on Netlify |
| Manual | 375–430px, sticky CTA, back button, Web Share, Stripe |

Privacy regressions: partner answers absent; analytics allowlist; hard-line anonymity.

---

## 15. Metrics

**North star:** Paid completed checks  

**Funnel (optimize partner join hardest):** Start → Invite → Both complete → Pay → Results viewed  

Secondary: reveal rate, conversation open, retake, share taps.

Initial targets (directional): landing→start 10–20%; creator complete 70%+; partner join 70%+; partner complete 70%+; pair→pay 40%+.

---

## 16. Definition of done

On a Netlify production URL, a stranger can: Start → Invite → Both assess (96 + follow-ups) → Either pays $29 → Both see conversations + Alignment Index → Mutual reveal → Delete account—with partner answers never exposed except via mutual reveal, and tone that never judges.
