# Unsaid

**Before you wed. Check Unsaid.**

Private, double-blind premarital compatibility check. Two people answer the same questions independently. Unsaid finds the conversations worth having before marriage—not whether you should marry.

**$29 per couple · No subscription**

## Stack (locked)

| Layer | Choice |
| --- | --- |
| App | Next.js App Router |
| Host | Netlify (OpenNext) |
| Auth | Clerk (email OTP) |
| DB | Netlify Database (Postgres) |
| Pay | Stripe Checkout |
| Email | Resend |

## Docs

- [**E2E locks**](docs/E2E_LOCKS.md) — authoritative decisions when docs conflict
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Flows](docs/FLOWS.md) — invite handoff, Stripe, offline, admin
- [Copy deck](docs/COPY.md)
- [API contract](docs/API_CONTRACT.md)
- [Data model](docs/DATA_MODEL.md)
- [Scoring](docs/SCORING.md) · [Golden fixtures](content/fixtures/scoring-golden.json)
- [Privacy](docs/PRIVACY.md)
- [Design tokens](docs/DESIGN_TOKENS.md)
- [SEO briefs](docs/SEO_BRIEFS.md)
- [Emails](docs/EMAILS.md)
- [Question bank 2026.09](content/questions/2026.09.json)

## Engineering stubs

- `.env.example` · `package.json` (Node ≥ 20) · `netlify.toml` · `.github/workflows/ci.yml`

## Deploy rule

We only build what Netlify can run: Next.js App Router + `@netlify/database` migrations + Clerk + Stripe webhooks on Route Handlers.
