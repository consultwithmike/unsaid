# Unsaid — Implementation Plan

**Status:** Locked product definition · ready for build  
**Stack:** React + TypeScript + Vite · Netlify · Supabase Auth/Postgres · Stripe · Resend  
**Price:** $29 per couple, one-time · no subscription  
**Tagline:** Before you wed. Check Unsaid.

This plan turns the product lock into an executable build order. Decisions below are treated as final unless explicitly revised.

---

## 1. What we are building

Unsaid is a private, double-blind premarital compatibility check. Two people answer the same 96 questions independently. Neither sees the other’s answers. When both finish, the server compares answers (weighted by importance and hard lines) and surfaces conversations worth having—not a marry/don’t-marry verdict.

**The transaction that matters:**

> Your Unsaid is ready.  
> You have N conversations worth having.  
> Unlock for both · $29

Everything else exists to make that moment trustworthy, private, and worth paying for.

---

## 2. Locked technical decisions

| Layer | Choice | Why |
| --- | --- | --- |
| App shell | Vite + React + TypeScript | Spec · Netlify-friendly SPA/PWA |
| Routing | React Router | Multi-step flows + deep links (`/invite/:token`) |
| Data fetching | TanStack Query | Optimistic saves, retries, cache for check state |
| Forms | React Hook Form + Zod | Assessment + onboarding validation |
| Hosting | Netlify CDN + Functions | Static shell + sensitive server ops |
| Auth | Supabase Auth (magic link / OTP) | Passwordless MVP · JWT sessions |
| DB | Supabase Postgres + RLS | Relational model · participant isolation |
| Answers | `private.responses` + AES-256-GCM | Never via public Data API · never partner-readable |
| Payments | Stripe Checkout + webhook | Trust webhook, not client redirect |
| Email | Resend | Invite, reminder, ready, reveal |
| Monitoring | Sentry (PII scrubbed) | Errors without relationship content |
| Analytics | Privacy-safe event names only | No answers, topics, or mismatches |

**Hard rules:**

1. Partner answers never leave the server in raw form.
2. Comparison runs once, server-side, when both participants complete.
3. Historical results store `algorithm_version` + `question_set_version` and are never silently recomputed.
4. Brand string is always `Unsaid` (never `UNSAID`, `unsaid.`, `UnSaid`).

---

## 3. Repository layout

```
/
├── netlify.toml
├── package.json
├── index.html
├── public/                 # PWA manifest, icons
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/             # tokens, global, motion
│   ├── components/         # Button, Field, Progress, etc.
│   ├── features/
│   │   ├── landing/
│   │   ├── auth/
│   │   ├── checks/         # create, invite, waiting, ready
│   │   ├── assessment/     # section intro, question screen
│   │   ├── results/        # summary, detail, reveal
│   │   ├── dashboard/
│   │   ├── settings/
│   │   └── seo/            # editorial pages
│   ├── lib/
│   │   ├── supabaseClient.ts   # anon client only
│   │   ├── api.ts              # typed fetch wrappers
│   │   ├── analytics.ts
│   │   └── offlineQueue.ts     # pending answer sync
│   ├── content/
│   │   ├── questions/      # question bank JSON by version
│   │   ├── conversationPrompts.ts
│   │   └── copy.ts         # brand/legal tone strings
│   └── routes.tsx
├── netlify/functions/      # API surface
│   ├── checks-create.ts
│   ├── checks-invite.ts
│   ├── invitations-accept.ts
│   ├── checks-get.ts
│   ├── responses-upsert.ts
│   ├── assessment-complete.ts
│   ├── checks-calculate.ts
│   ├── checks-checkout.ts
│   ├── stripe-webhook.ts
│   ├── results-get.ts
│   ├── results-reveal.ts
│   ├── checks-delete.ts
│   ├── account-delete.ts
│   └── reminders-send.ts
├── shared/                 # isomorphic types + scoring pure functions
│   ├── types.ts
│   ├── scoring.ts          # unit-tested
│   ├── distances.ts
│   └── questionSet.ts
├── supabase/
│   ├── migrations/
│   └── seed/
└── docs/
    ├── IMPLEMENTATION_PLAN.md
    ├── DATA_MODEL.md
    ├── SCORING.md
    └── PRIVACY.md
```

Shared scoring lives in `shared/` so Netlify Functions and unit tests use the same pure algorithm. The browser never receives raw partner answers to score against.

---

## 4. Design system (ship first)

Implement tokens before feature UI so every screen shares one language.

### Tokens (`src/styles/tokens.css`)

| Role | Token | Hex |
| --- | --- | --- |
| bg | `--color-ivory` | `#FAF7F2` |
| text | `--color-ink` | `#181416` |
| brand | `--color-wine` | `#54263A` |
| brand-hover | `--color-wine-dark` | `#3F1C2C` |
| accent | `--color-rose` | `#B8667A` |
| bg-2 | `--color-stone` | `#EEE9E4` |
| aligned | `--color-sage` | `#6E806F` |
| conversation | `--color-ochre` | `#B47A32` |
| major | `--color-brick` | `#A34D46` |
| border | `--color-warm-gray` | `#DDD6D0` |
| white | `--color-white` | `#FFFFFF` |

### Typography

- Display: **Newsreader** 500/600/700 (hero, headings, Alignment Index, result statements)
- UI: **Inter** 400/500/600/700
- Mobile type scale as specified (hero 48/50 → small 14/20)
- Min UI text: 14px · touch targets ≥ 44px · buttons 52px / radius 14px

### Layout

- Mobile-first · content max **640px** · results desktop max **960px**
- Side padding: 20 → 24 → 32
- One composition landing hero (brand-led, not dashboard)
- Atmosphere via warm ivory + subtle texture/gradient—not flat white SaaS

### Motion (2–3 intentional)

1. Hero brand / headline fade-rise on load  
2. Question answer selection press feedback  
3. Results unlock reveal (Alignment Index + conversation count)

Respect `prefers-reduced-motion`.

---

## 5. Data model (MVP tables)

See also `docs/DATA_MODEL.md` (to be filled in Phase 0).

**Public schema (RLS):** `users`/`profiles` via Supabase Auth, `checks`, `check_participants`, `invitations` (token **hash** only), `questions`, `results`, `result_items`, `reveals`, `payments`, `discussed_flags` (optional).

**Private schema (service role only):** `private.responses` with encrypted answer payload.

**Encryption:**

- Per-check DEK (AES-256-GCM)
- DEK wrapped by app master key from Netlify env (`ANSWER_MASTER_KEY`)
- Encrypt/decrypt only in Functions

**Check statuses:** `created` → `active` → `awaiting_partner` → `ready` → `unlocked` · plus `expired` / `deleted`.

---

## 6. Scoring (pure module)

Implement and unit-test in Phase 3 before wiring UI.

For each question:

- `d(q)` = distance 0–1 by type (`AG5`, `YN3`, `ORD`, `CAT`, `MULTI`)
- `w(q) = sqrt(iA × iB)`
- `Q(q) = 100 × (1 - d)`
- Alignment Index = `100 × [1 - Σ(d·w)/Σw]` (also per category)

**Hard-line collision:** `d ≥ 0.75` AND either hard line → counts separately; visual class becomes **Major conversation**; `impact × 2`.

**Impact sort:** `impact = d × sqrt(iA × iB)` (×2 if collision).

**Language:** never “96% compatible” · say **Alignment Index: 82**.

Bands: 85–100 Mostly aligned · 70–84 Some important differences · 55–69 Several · &lt;55 Major differences worth understanding.

Headline result: **You have N conversations worth having** (primary). Score is secondary.

Special cases called out in bank:

- CP02 “I genuinely don’t care” → low distance unless high importance
- MO02 CAT options use ordered distance despite CAT label
- HL02 needs custom compatibility matrix
- Follow-ups: CP07 MULTI when AG5 ≥ 4; MO04 large-purchase ORD when relevant

---

## 7. API surface (Netlify Functions)

All sensitive ops server-side. Auth via Supabase JWT on each request.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/checks` | Create check + participant A |
| POST | `/api/checks/:id/invite` | Create invitation (hash token) |
| POST | `/api/invitations/:token/accept` | Partner B join |
| GET | `/api/checks/:id` | Safe check state for participant |
| POST | `/api/responses` | Upsert encrypted own answer |
| POST | `/api/assessment/complete` | Mark complete; maybe trigger calc |
| POST | `/api/checks/:id/calculate` | Internal/idempotent compare |
| POST | `/api/checks/:id/checkout` | Stripe Checkout session |
| POST | `/api/stripe/webhook` | Set paid / unlocked |
| GET | `/api/checks/:id/results` | Diffs only (no partner answers) |
| POST | `/api/results/:question/reveal` | Mutual reveal state machine |
| POST | `/api/checks/:id/remind` | Rate-limited reminder |
| DELETE | `/api/checks/:id` | Soft-delete check |
| DELETE | `/api/account` | Full account wipe |

**Never exist:** any endpoint that returns partner answers without mutual reveal.

Redirects in `netlify.toml`: `/api/*` → `/.netlify/functions/:splat` (or per-function routes).

Env via `Netlify.env.get(...)` in Functions—never hardcoded secrets.

---

## 8. Primary user journeys (build order)

```
Person A                         Person B
Landing                          Invite link
  → Auth (magic link)              → Privacy explainer
  → Create check                   → Auth
  → Partner name + stage           → Accept invite
  → Share invite                   → Assessment (96)
  → Assessment (96)                → Waiting / Ready
  → Waiting                        → Pay or wait for A
  → Ready · $29 unlock
  → Results (both)
```

**Critical path to monetization:** Start → Invite → Both complete → Pay.

Optimize Partner B’s first session hardest (largest drop-off).

---

## 9. Phased delivery

### Phase 0 — Foundation (unblock everything)

- Scaffold Vite React TS app + Netlify config + `.gitignore` (include `.netlify`)
- Install deps: React Router, TanStack Query, Zod, RHF, Supabase JS, Stripe
- Design tokens, fonts, Button/Input primitives, layout shells
- Supabase project wiring docs + first migrations (empty tables)
- Shared TypeScript types
- CI: typecheck + unit test script
- Env template: `SUPABASE_*`, `STRIPE_*`, `ANSWER_MASTER_KEY`, `RESEND_*`, `SENTRY_*`

**Exit:** `netlify dev` serves empty shell with design tokens visible.

### Phase 1 — Landing + brand moment

- Hero: brand **Unsaid** dominant · tagline · supporting copy · Start / See how it works · `$29 · No subscription`
- Problem / How it works / Privacy / Final CTA sections (spec §41)
- Legal footer: 18+, not therapy/advice disclaimer
- Analytics: `landing_viewed`, `start_clicked`
- Mobile LCP target &lt; ~2s (fonts, minimal JS on landing)

**Exit:** Landing matches brand principles; CTA routes to auth stub.

### Phase 2 — Auth + account shell

- Magic link / OTP via Supabase Auth
- Collect email + first name; optional preferred name / pronouns
- 18+ confirmation
- Session-aware app shell + logout
- Dashboard empty state
- Account deletion flow (confirmation `DELETE`) — can stub backend until Phase 8

**Exit:** User can sign in and land on dashboard.

### Phase 3 — Question bank + scoring engine

- Author `question_set_version: 2026.09` with all 96 questions + prompts + matrices
- Implement `shared/distances.ts` + `shared/scoring.ts` with fixtures
- Unit tests for AG5/YN3/ORD/CAT/MULTI, weights, hard-line collisions, CP02 special case, impact sort
- Seed `questions` table from bank

**Exit:** Scoring pure functions fully tested; no UI dependency.

### Phase 4 — Check creation + invitation

- Create check UI (relationship stage, optional wedding date, partner first name)
- Generate `check_id` + 128-bit invite token (store hash only, 30-day expiry)
- Invite screen: Share (Web Share API) + Copy link
- Accept invitation flow for B (privacy copy, single-partner lock once B starts)
- Email: partner invitation (Resend)
- Rate limits on create/invite

**Exit:** A can invite B; B can join; second partner cannot be swapped after B starts.

### Phase 5 — Assessment experience

- Section intro (title, one sentence, 8 q · ~90s)
- One question per screen: prompt, answer control, importance 1–5, hard-line toggle if importance ≥ 4
- Progress: `Money · 4 of 8`
- Optimistic save + offline queue (“Saving…” / sync on reconnect)
- Never mark section complete until server confirms
- Resume mid-assessment
- Waiting screen with partner progress % + reminder (1 / 24h)
- Section complete: “Money done. Answers saved privately.” — **no score**

**Exit:** Full 96-question path save/resume works for both roles.

### Phase 6 — Calculate + paywall

- On both complete: server decrypts, scores, writes `results` + `result_items`, status `ready`
- Ready screen: conversation count + locked CTA · `$29` · Stripe Checkout
- Webhook sets `payment_status=paid`, `unlocked_at`, status `unlocked`
- Emails: partner finished · results ready
- Do not unlock on client return alone

**Exit:** Paid unlock works end-to-end in Stripe test mode.

### Phase 7 — Results + mutual reveal

- Summary: “You have N conversations…” · Alignment Index · count cards · impact-sorted list
- Detail: classification, hard-line-aware copy, conversation prompts, no partner answers
- Request mutual reveal / consent / irreversible warning
- Mark discussed
- Retake CTA → new check ($29), never overwrite
- Viral share block: “Know someone getting serious?”
- Tone audit: no judgment language

**Exit:** Full results UX matches §28–31; privacy invariants hold.

### Phase 8 — Trust, retention, abuse

- Account + check deletion with encrypted answer purge queue
- 90-day inactivity cleanup job (scheduled Function)
- Rate limits: auth, reminders, checkout, reveals
- Sentry scrubbing
- Analytics allowlist only (§40)
- Accessibility pass: WCAG AA, focus, SR labels, reduced motion, text not color-only

**Exit:** Deletion + retention + rate limits documented and tested.

### Phase 9 — SEO + PWA

- Editorial pages (§42) linking to Start
- Installable PWA (manifest, icons, basic SW for shell—not full offline assessment)
- Basic `/admin` (counts, funnel, question versions, payment status)—**no casual plaintext answer browse**

**Exit:** Marketing pages live; admin read-only metrics usable.

---

## 10. Explicit non-goals (MVP)

Do not build: AI advice, chat, therapist marketplace, wedding planning, subscriptions, social profiles, community, dating matching, public scores, native apps, referral discounts, counselor product, compare-over-time.

---

## 11. Testing strategy

| Layer | What |
| --- | --- |
| Unit | Scoring, distances, CAT matrices, encryption wrap/unwrap |
| Function | Authz (cannot read partner), invite hash, webhook idempotency, reveal state machine |
| E2E (later) | Happy path A+B → pay → results; invite expiry; reminder throttle |
| Manual | Mobile 375–430 widths; Web Share; Stripe test cards |

Privacy regression suite (must stay green):

1. Authenticated user cannot fetch partner encrypted or plaintext answers.
2. Results payload contains no `answer` fields unless `reveals` status is `mutual`.
3. Analytics payloads reject forbidden properties.

---

## 12. Security checklist (before production)

- [ ] RLS on every public table; private schema not exposed
- [ ] Service role key only in Functions
- [ ] Master encryption key only in Netlify env
- [ ] Invitation tokens hashed (SHA-256+) · raw shown once
- [ ] Stripe webhook signature verification
- [ ] CORS locked to site origin
- [ ] Rate limiting on abuse-prone endpoints
- [ ] No answer content in logs, Sentry, email subjects, or analytics
- [ ] Minimum age 18 enforced at signup

---

## 13. Env & Netlify

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANSWER_MASTER_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID          # $29 one-time
RESEND_API_KEY
EMAIL_FROM
SENTRY_DSN
SITE_URL
```

Client may only receive anon Supabase URL/key and public Stripe publishable key if needed (Checkout is hosted, so publishable may be unused).

Add `.netlify` to `.gitignore`. Use `Netlify.env.get` in Functions.

---

## 14. Metrics to instrument from day one

**North star:** Paid completed checks  

**Funnel:** Start → Invite → Both complete → Pay → Results viewed  

Secondary: reveal request rate, conversation open, retake, referral share taps.

---

## 15. Suggested first implementation sprint

Build in this order so the product moment is reachable ASAP:

1. Phase 0 scaffold + tokens  
2. Phase 3 scoring + question bank (parallelizable with UI)  
3. Phase 2 auth  
4. Phase 4 checks + invites  
5. Phase 5 assessment  
6. Phase 6 calculate + Stripe  
7. Phase 7 results  
8. Phase 1 polish landing against real Start CTA  
9. Phases 8–9 hardening / SEO / admin  

Landing can ship early for marketing, but **do not delay encryption + scoring correctness** for visual polish.

---

## 16. Open implementation details (defaults chosen)

These were underspecified operationally; defaults for MVP:

| Topic | Default |
| --- | --- |
| Magic link vs OTP | Email OTP (6-digit) primary; magic link fallback if easier with Supabase template |
| Partner progress % | Count of saved answers / 96 (server-derived) |
| Discussed flag | `result_items.discussed_at` nullable |
| Follow-up questions | Same screen accordion after parent answer; stored as linked question codes |
| Admin auth | Allowlist emails in env (`ADMIN_EMAILS`) |
| Currency | USD only for MVP |
| PWA SW | Precache shell only; assessment requires network |

---

## 17. Definition of done (MVP)

A stranger on a phone can:

1. Start a check and invite a partner  
2. Both complete all 96 questions privately  
3. See “Your Unsaid is ready” with conversation count  
4. Pay $29 once via Stripe  
5. Both unlock results with Alignment Index + impact-sorted conversations  
6. Request/consent mutual reveal on one topic  
7. Delete account/check  

…with partner answers never exposed to the client except via mutual reveal, and with tone that never judges answers.

---

*Unsaid — Before you wed. Check Unsaid.*
