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

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Data model](docs/DATA_MODEL.md)
- [Scoring](docs/SCORING.md)
- [Privacy](docs/PRIVACY.md)

## Deploy rule

We only build what Netlify can run: Next.js App Router + `@netlify/database` migrations + Clerk + Stripe webhooks on Route Handlers.
