# Unsaid — API Contract

All routes are Next.js Route Handlers unless noted. Auth via Clerk `await auth()` except **Public** routes.

Base: same origin. No CORS headers.

---

## 1. Authz matrix

| Route | Auth | Participant rule |
| --- | --- | --- |
| `POST /api/checks` | Required | Creates check; caller becomes role A |
| `GET /api/checks/:id` | Required | Must be participant |
| `POST /api/checks/:id/invite` | Required | Role A only; blocked if B has started answering |
| `POST /api/invitations/:token/accept` | Required | Not already participant; not same profile as A; invite valid |
| `GET /api/responses?checkId=` | Required | Own participant row only |
| `POST /api/responses` | Required | Own participant; check not deleted/expired |
| `POST /api/assessment/complete` | Required | Own participant; all required answers present |
| `POST /api/checks/:id/calculate` | Required | Participant; both complete; idempotent |
| `POST /api/checks/:id/checkout` | Required | **Either** participant; status `ready`; unpaid |
| `POST /api/stripe/webhook` | **Public** | Stripe signature only |
| `GET /api/results/:checkId` | Required | Participant; payload depends on status (below) |
| `GET /api/results/:checkId/items/:questionId` | Required | Participant; unlocked for full item; own answer optional |
| `POST /api/results/:checkId/items/:questionId/reveal` | Required | Participant; unlocked |
| `POST /api/results/:checkId/items/:questionId/discussed` | Required | Participant; unlocked |
| `POST /api/checks/:id/remind` | Required | Participant who completed; 24h throttle |
| `POST /api/checks/:id/retake` | Required | Participant on unlocked/ready check; creates **new** check |
| `DELETE /api/checks/:id` | Required | Participant |
| `DELETE /api/account` | Required | Caller only |
| `POST /api/clerk/webhook` | **Public** | Clerk signature; user.deleted → purge queue |
| `GET /api/health` | **Public** | `SELECT 1` |

**Never exist:** any route that returns partner answers without `reveals.status = mutual`.

---

## 2. Middleware public paths

Clerk middleware must allow unauthenticated access to:

- `/` and marketing/SEO pages
- `/privacy`, `/terms`, `/disclaimer`
- `/sign-in(.*)`
- `/invite/(.*)` (page shell; accept still requires auth)
- `/api/stripe/webhook`
- `/api/clerk/webhook`
- `/api/health`
- Static assets / `_next`

Everything under `/(app)` and remaining `/api/*` requires a signed-in user.

---

## 3. Ready vs unlocked results payload

### `GET /api/results/:checkId` when `status = ready` (locked)

```json
{
  "status": "ready",
  "locked": true,
  "names": { "a": "Michael", "b": "Andrea" },
  "conversationCount": 7,
  "hardLineCollisionCount": 1,
  "alignmentIndex": null,
  "counts": null,
  "items": null,
  "priceCents": 2900,
  "currency": "usd"
}
```

Teaser may show conversation **count** and hard-line collision **count** only. No item list, no Alignment Index detail cards, no prompts.

### when `status = unlocked`

```json
{
  "status": "unlocked",
  "locked": false,
  "names": { "a": "Michael", "b": "Andrea" },
  "alignmentIndex": 78,
  "alignmentBand": "some_important_differences",
  "counts": {
    "aligned": 68,
    "minor": 21,
    "conversation": 6,
    "major": 1,
    "hardLineCollisions": 1
  },
  "items": [
    {
      "questionId": "…",
      "code": "CP01",
      "category": "Children & parenting",
      "title": "I want to have children.",
      "classification": "major_conversation",
      "hardLineCollision": true,
      "impact": 10,
      "distance": 1,
      "neutralDescription": "…",
      "prompts": ["…", "…"],
      "discussedAt": null,
      "revealStatus": "none"
    }
  ]
}
```

Items sorted by `impact` desc. **No answer fields.**

---

## 4. Own answers

### During assessment — `GET /api/responses?checkId=`

Returns **only the caller’s** responses (decrypted for self):

```json
{
  "participantId": "…",
  "answers": [
    {
      "questionId": "…",
      "code": "MO03",
      "answer": 4,
      "followUp": null,
      "importance": 5,
      "hardLine": true
    }
  ],
  "answerCount": 12
}
```

### On results — `GET /api/results/:checkId/items/:questionId`

Default body: item metadata + prompts + `revealStatus` — **no answers**.

Query `?include=own` adds:

```json
{ "ownAnswer": { "answer": 5, "label": "Strongly agree", "importance": 5, "hardLine": true } }
```

Partner answer included **only** if `revealStatus === "mutual"`:

```json
{
  "revealed": {
    "a": { "answer": 5, "label": "…" },
    "b": { "answer": 1, "label": "…" }
  }
}
```

---

## 5. Response upsert

`POST /api/responses`

```json
{
  "checkId": "…",
  "questionCode": "CP07",
  "answer": 5,
  "followUp": ["public_school", "private_school"],
  "importance": 4,
  "hardLine": false
}
```

Rules:

- `hardLine` accepted only if `importance >= 4`; otherwise forced `false`
- Follow-ups: `CP07` MULTI required when AG5 ∈ {4,5}; `MO04` threshold ORD when parent answered
- Encrypt answer (+ followUp) with check DEK; store importance/hardLine as columns
- Increment `answer_count` for distinct questions answered
- Idempotent upsert on `(participant_id, question_id)`

---

## 6. Reveal

`POST /api/results/:checkId/items/:questionId/reveal`

```json
{ "action": "request" | "consent" | "decline" }
```

State machine: `none` → `requested_by_a` | `requested_by_b` → `mutual`.  
On `mutual`, set `revealed_at`. Irreversible. Email partner on `request` (non-sensitive subject).

---

## 7. Discussed

`POST /api/results/:checkId/items/:questionId/discussed`

```json
{ "discussed": true }
```

Sets `result_items.discussed_at = now()` (or null if false).

---

## 8. Checkout & webhook

`POST /api/checks/:id/checkout` — either participant; Stripe Checkout Session; metadata:

- `check_id`
- `purchasing_clerk_user_id`
- `product_version`

`POST /api/stripe/webhook` — verify signature; on `checkout.session.completed`:

- Insert/update `payments`
- `checks.payment_status = paid`
- `checks.unlocked_at = now()`
- `checks.status = unlocked`
- Idempotent on `stripe_checkout_session`

Do **not** unlock on client return URL alone. Return URL may poll results until `unlocked`.

---

## 9. Retake

`POST /api/checks/:id/retake`

Creates a **new** check for the same two profiles (new id, new DEK, unpaid). Original row untouched. Returns `{ newCheckId, invite optional }`. Price still $29 when both complete again.

---

## 10. Accept invitation — abuse rules

Reject with 403/409 when:

- Token hash unknown or expired
- Invitation already accepted
- Caller is role A (self-join)
- Check already has participant B
- B has started answering and caller is a different user trying to replace (should not happen if accept-once)

---

## 11. Rate limits (DB-backed MVP)

Table `rate_limits (bucket text, subject text, window_start timestamptz, count int)`  
Or per-feature logs (`reminder_log`, etc.).

| Action | Limit |
| --- | --- |
| Invite create | 10 / profile / day |
| Reminder | 1 / check / sender / 24h |
| Checkout session create | 10 / check / hour |
| Reveal request | 30 / check / day |
| OTP / account (Clerk) | rely on Clerk + soft IP limit on accept |

---

## 12. Analytics (server allowlist)

Provider: **first-party** `analytics_events` table (no third-party payloads with relationship content).

Allowed `event_name` values only:

`landing_viewed`, `start_clicked`, `check_created`, `invitation_created`, `partner_joined`, `assessment_started`, `section_completed`, `assessment_completed`, `check_ready`, `checkout_started`, `purchase_completed`, `results_viewed`, `conversation_opened`, `reveal_requested`, `reveal_completed`, `check_deleted`, `retake_started`, `share_tapped`

Forbidden properties: answers, importance, hard lines, question codes tied to mismatches, section names for sexual/religious/political content, free text.

Allowed properties: `check_id` (opaque), `role`, `section_index` (0–11), `source`, `value` (numeric counts only).

---

## 13. Calculation timing

Do **not** score on each answer save.  
Run when both `completed_at` set — from `POST /api/assessment/complete` (second completer) or explicit `POST /api/checks/:id/calculate`.  
Persist `algorithm_version` + `question_set_version`. Never silently recompute historical results.
