# Unsaid — API Contract

All routes are Next.js Route Handlers unless noted. Auth via Clerk `await auth()` except **Public** routes.

Base: same origin. No CORS headers.

**Conflict rule:** [E2E_LOCKS.md](./E2E_LOCKS.md) wins over this file.  
Flows: [FLOWS.md](./FLOWS.md).

---

## 1. Authz matrix

| Route | Auth | Participant rule |
| --- | --- | --- |
| `POST /api/checks` | Required | Profile complete; creates check; caller becomes role A |
| `GET /api/checks/:id` | Required | Must be participant |
| `POST /api/checks/:id/invite` | Required | Role A; replace rules in E2E_LOCKS §3 |
| `POST /api/invitations/:token/accept` | Required | Profile complete; not already participant; not creator; invite valid |
| `GET /api/responses?checkId=` | Required | Own participant row only (+ resume cursor) |
| `POST /api/responses` | Required | Own participant; check not deleted/expired |
| `POST /api/assessment/complete` | Required | Own participant; dynamic requiredCount met; offline queue empty |
| `POST /api/checks/:id/calculate` | Required | Participant; both complete; idempotent (PK on results) |
| `POST /api/checks/:id/checkout` | Required | **Either** participant; status `ready`; unpaid; single open session |
| `GET /api/checks/:id/checkout/status` | Required | Participant; verifies Stripe session; **does not unlock** |
| `POST /api/stripe/webhook` | **Public** | Stripe signature only |
| `GET /api/results/:checkId` | Required | Participant; payload depends on status (below) |
| `GET /api/results/:checkId/items/:questionId` | Required | Participant; unlocked for full item; own answer optional |
| `POST /api/results/:checkId/items/:questionId/reveal` | Required | Participant; unlocked |
| `POST /api/results/:checkId/items/:questionId/discussed` | Required | Participant; unlocked |
| `POST /api/checks/:id/remind` | Required | Participant who completed; 24h throttle |
| `POST /api/checks/:id/retake` | Required | Participant on unlocked/ready check; creates **new** check |
| `DELETE /api/checks/:id` | Required | Participant |
| `GET /api/account/export` | Required | Caller only; own data JSON |
| `DELETE /api/account` | Required | Caller only |
| `GET /api/me` | Required | Profile + completeness flag |
| `PATCH /api/me` | Required | Upsert first name, 18+, optional fields |
| `POST /api/clerk/webhook` | **Public** | Clerk signature; user.deleted → purge queue |
| `GET /api/health` | **Public** | `SELECT 1` via `@netlify/database` |
| `GET /api/admin/*` | Required | Email ∈ `ADMIN_EMAILS` |

**Never exist:** any route that returns partner answers without `reveals.status = mutual`.

---

## 2. Middleware public paths

Allow unauthenticated:

- `/` and marketing/SEO pages
- `/privacy`, `/terms`, `/disclaimer`
- `/sign-in(.*)`
- `/invite/[^/]+$` **only** (token page). `/invite/continue` is **auth-required**.
- `/api/stripe/webhook`
- `/api/clerk/webhook`
- `/api/health`
- Static / `_next`

Require auth: `/(app)/*`, `/onboarding`, `/invite/continue`, `/admin(.*)`, remaining `/api/*`.

Admin paths: signed-in **and** primary email in `ADMIN_EMAILS` (else 404).

---

## 3. Profile completeness

`GET /api/me` → `{ profile, complete: boolean }`  
`complete = firstName present && ageConfirmed18 === true`

`POST /api/checks` and invitation accept return **403** `{ code: "PROFILE_INCOMPLETE" }` if not complete. Client sends user to `/onboarding?next=…`.

---

## 3b. Create check

`POST /api/checks` body/response: **E2E_LOCKS §1**.

---

## 3c. Get check

`GET /api/checks/:id` shape: **E2E_LOCKS §10** (includes partner progress % without decryption).

---

## 4. Ready vs unlocked results payload

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
  "categoryScores": null,
  "items": null,
  "priceCents": 2900,
  "currency": "usd"
}
```

`conversationCount` mapping: **E2E_LOCKS §8**.

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
  "categoryScores": [
    { "sectionId": "children_parenting", "label": "Children & parenting", "alignmentIndex": 42 },
    { "sectionId": "money", "label": "Money", "alignmentIndex": 81 }
  ],
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
UI routes: `/results/[checkId]` and `/results/[checkId]/items/[questionId]` (E2E_LOCKS §9).  
If `payment_status = refunded`, API behaves as **ready/locked** teaser; results rows retained.

---

## 5. Own answers & resume cursor

### `GET /api/responses?checkId=`

```json
{
  "participantId": "…",
  "answerCount": 12,
  "requiredCount": 97,
  "followUpsPending": ["CP07F"],
  "currentSectionId": "money",
  "currentQuestionCode": "MO04",
  "sectionProgress": { "index": 2, "answeredInSection": 4, "sectionSize": 8 },
  "answers": [
    {
      "questionId": "…",
      "code": "MO03",
      "answer": 4,
      "importance": 5,
      "hardLine": true
    }
  ]
}
```

`requiredCount` is **dynamic** (E2E_LOCKS §4). Never hardcode 96 when follow-ups pending.

### Results item — `GET /api/results/:checkId/items/:questionId`

Default: metadata + prompts + `revealStatus` — **no answers**.  
`?include=own` → `ownAnswer`. Partner only if `revealStatus === "mutual"`.

---

## 6. Response upsert (no embedded follow-ups)

`POST /api/responses`

```json
{
  "checkId": "…",
  "questionCode": "CP07",
  "answer": 5,
  "importance": 4,
  "hardLine": false
}
```

Follow-up example:

```json
{
  "checkId": "…",
  "questionCode": "CP07F",
  "answer": ["public", "private"],
  "importance": 4,
  "hardLine": false
}
```

Rules: E2E_LOCKS §4–5 + FLOWS §3. Option values must match bank (`public`, not `public_school`).

---

## 7. Reveal / discussed

State machine: `none` → `requested_by_a|b` → `mutual` (irreversible).  
Discussed sets `result_items.discussed_at`.

---

## 8. Checkout, return URL, webhooks

See **E2E_LOCKS §7** (single open session, idempotency key, success poll, refund re-lock).

`GET /api/checks/:id/checkout/status?session_id=` → `{ stripeStatus, checkStatus }` — **never** unlocks.

---

## 9. Calculate

`POST /api/assessment/complete` (second completer) and `POST /api/checks/:id/calculate`:

- `SELECT checks FOR UPDATE`
- Insert `results` with `ON CONFLICT (check_id) DO NOTHING`
- On insert: write `result_items`, `category_scores`, set `checks.status=ready`
- If row already exists: return existing summary; no recompute

---

## 10. Account export

`GET /api/account/export` → attachment JSON; own answers only (FLOWS / E2E_LOCKS).

---

## 11. Errors, rate limits, analytics

**E2E_LOCKS §11–13.**

---

## 12. Health

`GET /api/health` must use `getDatabase()` from `@netlify/database` inside the Route Handler on a real Netlify deploy (Phase 0 proof).
