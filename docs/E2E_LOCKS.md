# Unsaid — E2E MVP locks

Decisions that must not be reinvented during build. If another doc conflicts, **this file wins**.

MVP path: Start → create → invite → both assess → calculate → pay $29 → results → reveal → delete.

---

## 1. Create check

`POST /api/checks`

```json
{
  "relationshipStage": "seriously_dating" | "discussing_engagement" | "engaged" | "wedding_scheduled" | "other",
  "weddingDate": "YYYY-MM-DD" | null,
  "partnerFirstName": "Andrea"
}
```

Response:

```json
{
  "checkId": "uuid",
  "status": "awaiting_partner",
  "inviteToken": "raw-token-once",
  "inviteUrl": "https://{host}/invite/{token}",
  "inviteExpiresAt": "ISO-8601"
}
```

- Requires complete profile (first name + 18+).
- Creates check + participant A + invitation (token returned **once**; store hash only).
- `partner_first_name_pending` stored on `invitations` (and denormalized on `checks` for UI).
- `wedding_date` is a bare `DATE` (no timezone). `expires_at` / all timestamps = **UTC**.

---

## 2. Check status machine

| Status | Meaning |
| --- | --- |
| `awaiting_partner` | Created; B not yet accepted |
| `active` | Both joined; assessment in progress |
| `ready` | Both complete; results computed; unpaid / locked |
| `unlocked` | Paid; full results available |
| `expired` | Invite or inactivity expiry |
| `deleted` | Soft-deleted |

Transitions:

| Event | From → To |
| --- | --- |
| Create check | → `awaiting_partner` |
| B accepts invite | `awaiting_partner` → `active` |
| Both complete + calculate succeeds | `active` → `ready` |
| Stripe `checkout.session.completed` | `ready` → `unlocked` |
| Full refund (`charge.refunded`) | `unlocked` → `ready` (results rows kept; API serves teaser) |
| Invite TTL / 90-day inactivity job | `awaiting_partner`\|`active` → `expired` |
| User deletes check | * → `deleted` |

Do not use a separate `created` status.

---

## 3. Invite continue + middleware

- Public page: `/invite/[token]` only (matcher `^/invite/[^/]+$`).
- Cookie: `unsaid_pending_invite` = raw token (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`).
- After Clerk OTP: always `/invite/continue` (auth required) — **not** `/invite/[token]/continue`.
- Middleware public: `/invite/([^/]+)$` — does **not** make `/invite/continue` public.

### Replace invite

`POST /api/checks/:id/invite` (role A):

- Allowed if no B **or** B exists with `answer_count = 0` and `completed_at IS NULL`.
- Effect: new token (old hash invalid), update `partner_first_name_pending`, reset `expires_at` = now+30d UTC.
- If B `answer_count > 0`: `409 INVITE_LOCKED`.

---

## 4. Completeness / `requiredCount`

Bank: **96 primary** + **2 follow-ups** (`CP07F`, `MO04F`) = 98 rows.

Per participant:

```
requiredCount = 96 + (CP07 ∈ {4,5} ? 1 : 0) + (MO04 ∈ {3,4,5} ? 1 : 0)
answerCount   = distinct saved responses for required codes only
complete      = answerCount === requiredCount && followUpsPending.length === 0
```

Marketing copy may still say “96 questions.” API never hardcodes `requiredCount: 96` when a follow-up is pending.

Progress % (waiting UI):

```
partnerPct = floor(100 * partnerAnswerCount / partnerRequiredCount)
```

Computed from `answer_count` + live requiredCount — **never decrypt** for progress.

---

## 5. Question seed mapping

File: `content/questions/2026.09.json` → table `questions`.

| JSON | Column | Notes |
| --- | --- | --- |
| `code` | `code` | PK with version |
| `section` | `section_id` | |
| `displayOrder` | `display_order` | **`numeric`** (allows 7.1, 4.1) |
| `text` | `prompt` | |
| `responseType` | `response_type` | AG5 \| ORD \| CAT \| MULTI |
| `responseOptions` | `options` jsonb | |
| `neutralDescription` | `neutral_description` | |
| `prompts` | `conversation_prompts` jsonb | |
| `parentCode` | `parent_code` | nullable |
| `followUpWhen` / `hiddenUnlessParent` | `show_when` jsonb | normalize either key into one column |
| `compatibilityMatrix` | `compatibility_matrix` jsonb | |
| `distanceMode` | `distance_mode` | |
| `specialScoring` | `special_scoring` | |
| `toneNote` | `tone_note` | optional |

Seed is idempotent upsert on `(code, question_set_version)`.

---

## 6. Encryption

Env: `ANSWER_MASTER_KEY` = **32 raw bytes, standard Base64** (44-char typical). Reject wrong length at boot.

On check create:

1. `dek = random(32)`
2. `iv = random(12)`
3. AES-256-GCM encrypt DEK with master key → store `checks.encrypted_dek`, `checks.dek_iv`, `checks.dek_auth_tag` (or single bytea = iv \| tag \| ciphertext — pick **iv(12) + tag(16) + ciphertext** layout).

Each response:

- Payload UTF-8 JSON `{ "answer": <scalar|array> }` only
- AES-256-GCM with DEK; store `ciphertext`, `iv`, `auth_tag`
- Follow-ups = separate rows

---

## 7. Dual checkout

- At most one `payments` row in (`open`,`paid`) per `check_id` (partial unique index).
- `POST /api/checks/:id/checkout`:
  - If `status != ready` or already `unlocked` → 409
  - If open Stripe session exists and unexpired → return its URL
  - Else create Checkout Session with Stripe Idempotency-Key `checkout:{checkId}:{priceId}`
- `success_url`: `/checks/{id}/unlock?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url`: `/checks/{id}/ready?checkout=cancelled`
- Unlock **only** via webhook `checkout.session.completed`
- If a second session somehow pays after already `paid`: refund duplicate automatically; do not change unlock

`payments.status`: `open` \| `paid` \| `refunded` \| `expired`

---

## 8. Classification → counts → teaser

DB / scoring labels:

`aligned` \| `slight` \| `conversation` \| `major` \| `major_conversation`

API `counts`:

```json
{
  "aligned": n,
  "minor": n,
  "conversation": n,
  "major": n,
  "hardLineCollisions": n
}
```

Map: `slight → minor`; `major` + `major_conversation → major`.

**Teaser / headline `conversationCount`** =

`count(conversation) + count(major) + count(major_conversation)`

(Hard-line collisions are also major_conversation; do not double-count rows.)

---

## 9. Results routes

- List/summary: `/results/[checkId]` ← `GET /api/results/:checkId`
- Detail: `/results/[checkId]/items/[questionId]` ← `GET /api/results/:checkId/items/:questionId`
- Reveal / discussed POSTs as in API_CONTRACT
- List rows never include answers

---

## 10. `GET /api/checks/:id` shape

```json
{
  "id": "uuid",
  "status": "active",
  "relationshipStage": "engaged",
  "weddingDate": null,
  "you": { "role": "A", "firstName": "Michael", "completed": false, "answerCount": 12, "requiredCount": 96, "pct": 12 },
  "partner": { "role": "B", "firstName": "Andrea", "joined": true, "completed": false, "answerCount": 4, "requiredCount": 96, "pct": 4 },
  "inviteExpiresAt": "ISO-8601|null",
  "paymentStatus": "unpaid",
  "unlockedAt": null
}
```

If partner not joined: `partner.joined=false`, names from `partner_first_name_pending`, counts null/0.

---

## 11. Analytics allowlist (first-party)

Only these `event_name` values:

`landing_viewed`, `start_clicked`, `check_created`, `invite_sent`, `partner_joined`, `assessment_started`, `section_completed`, `assessment_completed`, `check_ready`, `checkout_started`, `checkout_completed`, `results_viewed`, `conversation_opened`, `reveal_requested`, `reveal_completed`, `check_deleted`, `retake_started`, `share_tapped`, `account_exported`, `account_deleted`

Props: opaque `checkId`, `role`, `sectionIndex` (0–11), `source`, numeric `value` only.

---

## 12. Error codes (API JSON `{ code, message }`)

| Code | HTTP |
| --- | --- |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `PROFILE_INCOMPLETE` | 403 |
| `NOT_FOUND` | 404 |
| `INVITE_EXPIRED` | 410 |
| `INVITE_LOCKED` | 409 |
| `SELF_JOIN` | 403 |
| `CHECK_STATE` | 409 |
| `VALIDATION` | 400 |
| `FOLLOW_UP_REQUIRED` | 400 |
| `OFFLINE_QUEUE_NONEMPTY` | 409 |
| `RATE_LIMITED` | 429 |
| `PAYMENT_REQUIRED` | 402 |
| `CONFLICT` | 409 |

---

## 13. Rate limits

| Bucket | Limit |
| --- | --- |
| `invite_create` | 10 / profile / day |
| `invite_replace` | 10 / check / day |
| `remind` | 1 / check / sender / 24h |
| `checkout_create` | 10 / check / hour |
| `reveal_request` | 30 / check / day |
| `export` | 5 / profile / day |

---

## 14. MVP scope cuts (explicit)

**In MVP:** legal **stubs** OK (`/privacy` `/terms` `/disclaimer` with COPY disclaimer + “full policy forthcoming”); support email in footer.

**Not required for E2E launch:** PWA installability, `/admin` UI, SEO long-form bodies (routes may 404 or stub), i18n, native apps.

**Required for E2E launch:** health route with DB, Clerk OTP, create/invite/accept, full assessment + follow-ups, calculate, Stripe test pay, results + reveal, delete/export.

---

## 15. Email / DNS

- Resend from `EMAIL_FROM` (e.g. `Unsaid <noreply@unsaid.app>`).
- Production: SPF/DKIM for sending domain in Resend dashboard (ops checklist; not app code).
- Preview/dev: Resend test mode or log-only sink if key missing (`EMAIL_MODE=log`).

---

## 16. Netlify

- Next.js auto-detect / OpenNext; `netlify.toml` build `npm run build`.
- Migrations: `netlify/database/migrations/<nnn>_<slug>/migration.sql`, lexical order, apply on deploy before publish.
- Node 20.
