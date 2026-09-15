# Unsaid — Critical Flows (locked)

Companion to [API_CONTRACT.md](./API_CONTRACT.md) and [COPY.md](./COPY.md).  
**Conflict rule:** [E2E_LOCKS.md](./E2E_LOCKS.md) wins.

---

## 1. Invite → auth handoff

Partner may be logged out when opening the invite.

1. `GET /invite/[token]` (public) validates token hash exists and is unexpired (not invalidated). Renders inviter first name + privacy copy.
2. CTA **Join {Name}** stores pending invite:
   - Cookie `unsaid_pending_invite` = raw token, `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`
   - Pass Clerk redirect to `/invite/continue` (not `/invite/[token]/continue`)
3. Clerk sign-in / sign-up with email OTP. Configure:
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/invite/continue`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/invite/continue`
4. `GET /invite/continue` (auth required):
   - Read cookie `unsaid_pending_invite`
   - If missing, show “Invitation link required” + CTA to home
   - Run same accept logic as `POST /api/invitations/:token/accept`
   - Clear cookie
   - If profile incomplete → `/onboarding?next=/assessment/[checkId]`
   - Else → `/assessment/[checkId]`
5. If already signed in on step 2, skip Clerk and go to accept → onboarding gate → assessment.

**Self-join:** Accept rejects if `auth.userId` matches check creator’s Clerk id (`SELF_JOIN`).

**Replace invite:** E2E_LOCKS §3 — allowed only if B not joined or B `answer_count = 0`.

**Middleware:** public matcher is `/invite/[^/]+$` only; `/invite/continue` requires auth.

---

## 2. Profile gate (onboarding)

`profiles` is complete when: `first_name` non-empty AND `age_confirmed_18 = true`.

**Enforced before:** create check, accept invite, assessment writes.

Incomplete → `/onboarding?next={encodedReturnPath}`.

---

## 3. Follow-up storage (single model)

Follow-ups are **separate question rows** and **separate `responses` rows**.

| Parent | Follow-up | When required |
| --- | --- | --- |
| `CP07` AG5 | `CP07F` MULTI | Parent ∈ {4,5} |
| `MO04` AG5 | `MO04F` ORD | Parent ∈ {3,4,5} |

- Parent ciphertext = `{ answer: number }` only
- Follow-up ciphertext = `{ answer: string | string[] }` on follow-up `question_id`
- One `questionCode` per `POST /api/responses`
- Completeness: dynamic `requiredCount` (E2E_LOCKS §4)
- Scoring: exclude follow-up from Σ when parent did not trigger it

---

## 4. Assessment resume cursor

`GET /api/responses?checkId=` returns `answerCount`, **dynamic** `requiredCount`, `followUpsPending`, `currentQuestionCode`, `sectionProgress`, own `answers`.

Cursor: walk bank order; first unanswered required primary (and its required follow-up) wins.

Block `assessment/complete` while IndexedDB offline queue non-empty for that check (`OFFLINE_QUEUE_NONEMPTY`).

---

## 5. Calculate race / idempotency

When either participant completes:

1. Set `check_participants.completed_at`
2. If both completed → calculate path

Calculate: `SELECT checks FOR UPDATE` → insert `results` `ON CONFLICT (check_id) DO NOTHING` → on insert write items + category scores → `status=ready`. Second writer no-ops.

---

## 6. Stripe Checkout return + refunds

### Create

`POST /api/checks/:id/checkout` — either participant; at most one `open|paid` payment row (E2E_LOCKS §7).

- `success_url`: `{SITE}/checks/{id}/unlock?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url`: `{SITE}/checks/{id}/ready?checkout=cancelled`
- Stripe Idempotency-Key: `checkout:{checkId}:{priceId}`

### Success page

1. Show “Confirming payment…”
2. Poll `GET /api/results/:id` every 2s for up to 60s
3. On `status=unlocked`, go to results
4. Optional session status endpoint verifies Stripe but **does not unlock**

### Webhooks

| Event | Action |
| --- | --- |
| `checkout.session.completed` | Mark paid; unlock; idempotent on session id |
| `charge.refunded` (full / MVP any) | `payment_status=refunded`; re-lock to teaser; keep results rows |
| `checkout.session.expired` | Mark payment `expired` if still `open` |

If a duplicate session pays after already paid: auto-refund duplicate; do not change unlock.

---

## 7. Offline answer queue

IndexedDB `unsaid-offline` / `pending_responses`, key `${checkId}:${questionCode}`.

1. Save → IDB → POST
2. Success → remove IDB row
3. Offline → keep queue; banner from COPY
4. On `online` / focus → flush FIFO (max 5 retries)
5. Never complete assessment with non-empty queue

---

## 8. Admin auth

`ADMIN_EMAILS` allowlist. `/admin` and `/api/admin/*` → 404 if not listed. No answer decrypt.

---

## 9. Preview / deploy allowlists

Add Deploy Preview URLs to Clerk allowed origins/redirects. Set `NEXT_PUBLIC_SITE_URL` per Netlify context. Stripe webhooks: CLI locally; register Preview URL when testing pay on Preview.

---

## 10. GDPR / account export

`GET /api/account/export` — profile, check metadata, **own** answers, reveals/discussed, payment receipts. Never partner answers.

`DELETE /api/account` — full purge (PRIVACY).

---

## 11. Email implementation

React Email in `/emails`, sent via Resend. Subjects from COPY — never sensitive topics.  
`EMAIL_MODE=log` when `RESEND_API_KEY` missing in dev.
