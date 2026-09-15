# Unsaid — Email templates

Implementation: **React Email** components in `/emails`, sent with **Resend**.

Locale: **en-US only** (MVP).

Copy source: [COPY.md](./COPY.md) §15. Subjects never include sensitive topics.

| File | Event |
| --- | --- |
| `emails/PartnerInvite.tsx` | Invitation created |
| `emails/PartnerFinished.tsx` | Other participant completed |
| `emails/ResultsReady.tsx` | Check → ready |
| `emails/RevealRequest.tsx` | Reveal requested |
| `emails/Reminder.tsx` | Reminder sent |

Shared layout: `emails/components/Layout.tsx` — wine wordmark “Unsaid”, ivory background, support footer `SUPPORT_EMAIL`.

Env: `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `NEXT_PUBLIC_SITE_URL`.
