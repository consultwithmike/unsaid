# Unsaid — Critical Flows (locked)

Companion to [API_CONTRACT.md](./API_CONTRACT.md) and [COPY.md](./COPY.md).

---

## 1. Invite → auth handoff

Partner may be logged out when opening the invite.

1. `GET /invite/[token]` (public) validates token hash exists and is unexpired (no accept yet). Renders inviter first name + privacy copy.
2. CTA **Join {Name}** stores pending invite:
   - Cookie `unsaid_pending_invite` = raw token, `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`
   - Also pass `redirect_url=/invite/[token]/continue` into Clerk sign-in
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

**Self-join:** Accept rejects if `auth.userId` matches check creator’s Clerk id.

---

## 2. Profile gate (onboarding)

`profiles` is complete when: `first_name` non-empty AND `age_confirmed_18 = true`.

**Enforced before:**

- `POST /api/checks`
- `POST /api/invitations/:token/accept` (and `/invite/continue`)
- Any assessment write

Incomplete profile → redirect `/onboarding?next={encodedReturnPath}`.

Onboarding fields (COPY §5): first name (required), 18+ checkbox (required), preferred name / pronouns (optional). Upsert `profiles`, then redirect to `next` or `/dashboard`.

Clerk may collect email only; **our** first name + 18+ are authoritative for product gates.

---

## 3. Follow-up storage (single model)

**Locked:** follow-ups are **separate question rows** and **separate `responses` rows**.

| Parent | Follow-up | When shown / required |
| --- | --- | --- |
| `CP07` AG5 | `CP07F` MULTI | Parent answer ∈ {4,5} |
| `MO04` AG5 | `MO04F` ORD | Parent answer ∈ {3,4,5} |

- Parent ciphertext = `{ answer: number }` only (no embedded followUp)
- Follow-up ciphertext = `{ answer: string | string[] }` on `question_id` for `CP07F` / `MO04F`
- `POST /api/responses` accepts one `questionCode` per call (parent or follow-up)
- Completeness: if parent triggers follow-up, follow-up response must exist before `assessment/complete`
- Scoring: exclude follow-up from Σ when parent did not trigger it

---

## 4. Assessment resume cursor

`GET /api/responses?checkId=` returns:

```json
{
  "participantId": "…",
  "answerCount": 12,
  "requiredCount": 96,
  "followUpsPending": ["CP07F"],
  "currentSectionId": "money",
  "currentQuestionCode": "MO04",
  "sectionProgress": { "index": 2, "answeredInSection": 4, "sectionSize": 8 },
  "answers": [ /* own answers only */ ]
}
```

Cursor rules:

1. Walk bank order; first unanswered required primary (and its required follow-up) wins.
2. Client may deep-link `?code=MO04` only if that code is unlocked (prior questions saved or already answered).
3. Browser back moves to previous code in bank order within the check.

---

## 5. Calculate race / idempotency

When either participant completes:

1. Set `check_participants.completed_at` in a transaction.
2. If both completed, call calculate path.

Calculate path:

```sql
INSERT INTO results (check_id, …)
VALUES ($checkId, …)
ON CONFLICT (check_id) DO NOTHING
RETURNING check_id;
```

- `results.check_id` is PRIMARY KEY → second writer no-ops
- Before insert, `SELECT … FOR UPDATE` on `checks` row
- Status transition `active|awaiting_partner` → `ready` only if still unpaid/unlocked-null
- Store `algorithm_version`, `question_set_version` at write time
- Never recompute if `results` row exists unless admin “recompute” tool (out of MVP)

Both clients may POST complete concurrently; exactly one results row.

---

## 6. Stripe Checkout return + refunds

### Checkout create

`POST /api/checks/:id/checkout` returns `{ url }` for Stripe-hosted Checkout.

Session:

- `mode=payment`
- `client_reference_id=check_id`
- `metadata`: `check_id`, `purchasing_clerk_user_id`, `product_version`
- `success_url`: `{SITE_URL}/checks/{checkId}/unlock?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url`: `{SITE_URL}/checks/{checkId}/ready?checkout=cancelled`

### Success page

1. Show “Confirming payment…” 
2. Poll `GET /api/results/:checkId` every 2s (max ~60s)
3. When `status=unlocked`, navigate to results
4. Optional: `GET /api/checks/:id/checkout/status?session_id=` verifies session with Stripe **but still does not unlock**—unlock only via webhook

### Webhook events

| Event | Action |
| --- | --- |
| `checkout.session.completed` | Mark payment paid; set `unlocked_at`; `status=unlocked`; idempotent on session id |
| `charge.refunded` / `charge.refund.updated` (full refund) | `payments.status=refunded`; `checks.payment_status=refunded`; **re-lock**: clear `unlocked_at`, `status=ready`; results rows **kept** but API returns locked teaser again until re-paid |
| `checkout.session.expired` | Log only |

Partial refunds: treat as refunded for MVP access (re-lock). Admin issues refunds via Stripe Dashboard or `/admin` → Stripe API.

---

## 7. Offline answer queue

Client module `lib/offlineQueue.ts`:

| Field | Notes |
| --- | --- |
| store | IndexedDB `unsaid-offline` / store `pending_responses` |
| key | `${checkId}:${questionCode}` |
| value | `{ checkId, questionCode, answer, importance, hardLine, clientUpdatedAt, retries }` |

Behavior:

1. On save: write IDB, optimistic UI “Saving…”, then `POST /api/responses`
2. On success: remove IDB row; show brief “Saved”
3. On network error: keep queue; banner “You’re offline…”
4. On `online` event / app focus: flush FIFO; max 5 retries then surface error
5. Server upsert by `(participant_id, question_id)` — last write wins by `updated_at`
6. **Do not** allow `assessment/complete` while queue non-empty for that check

---

## 8. Admin auth

- Env `ADMIN_EMAILS` comma-separated (lowercase)
- Middleware: paths `/admin(.*)` and `/api/admin(.*)` require signed-in user whose Clerk primary email is in the list
- Non-admins: 404 (do not reveal admin surface)
- Admin can: funnel counts, question set versions, payment status, trigger Stripe refund — **not** decrypt answers

---

## 9. Preview / deploy allowlists

For each Netlify Deploy Preview URL:

- Clerk: add Preview URL to allowed origins / redirect URLs (or use wildcard pattern if Clerk plan allows)
- Stripe webhook: use Stripe CLI locally; for Preview, either disable webhook tests or register Preview URL manually
- `NEXT_PUBLIC_SITE_URL` set per context (Netlify env context: production vs deploy-preview)
- Never reuse production webhook secret on unsigned local traffic

---

## 10. GDPR / account export

`GET /api/account/export` (auth required):

Returns JSON download (attachment):

- profile fields
- checks metadata (ids, statuses, dates, alignment index if unlocked)
- **own** decrypted answers only
- reveal / discussed flags
- payment receipts (amount, date, last4 if available) — no partner answers

`DELETE /api/account` remains full purge (see PRIVACY).

---

## 11. Email implementation

Templates live in `emails/` as React Email components; rendered in Route Handlers / jobs via Resend.

| Template file | Trigger |
| --- | --- |
| `PartnerInvite.tsx` | invite created |
| `PartnerFinished.tsx` | other participant completed |
| `ResultsReady.tsx` | status → ready |
| `RevealRequest.tsx` | reveal requested |
| `Reminder.tsx` | remind endpoint |

Locale: **en-US only** for MVP (explicit non-goal: i18n).

Subjects/bodies: [COPY.md](./COPY.md) §15 — never put sensitive topics in subjects.
