# Unsaid — API Contract

All routes are Next.js Route Handlers unless noted. Auth via Clerk `await auth()` except **Public** routes.

Base: same origin. No CORS headers.

Flows that span multiple routes: [FLOWS.md](./FLOWS.md).

---

## 1. Authz matrix

| Route | Auth | Participant rule |
| --- | --- | --- |
| `POST /api/checks` | Required | Profile complete; creates check; caller becomes role A |
| `GET /api/checks/:id` | Required | Must be participant |
| `POST /api/checks/:id/invite` | Required | Role A only; blocked if B has started answering |
| `POST /api/invitations/:token/accept` | Required | Profile complete; not already participant; not creator; invite valid |
| `GET /api/responses?checkId=` | Required | Own participant row only (+ resume cursor) |
| `POST /api/responses` | Required | Own participant; check not deleted/expired |
| `POST /api/assessment/complete` | Required | Own participant; all required answers present; offline queue empty |
| `POST /api/checks/:id/calculate` | Required | Participant; both complete; idempotent (PK on results) |
| `POST /api/checks/:id/checkout` | Required | **Either** participant; status `ready`; unpaid |
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
- `/invite/(.*)` (page shell + token display; accept/continue require auth)
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
`categoryScores` sorted ascending by `alignmentIndex` (weakest categories first) for UI “By topic” section.

If `payment_status = refunded`, API behaves as **ready/locked** teaser even though `results` rows remain stored.

---

## 5. Own answers & resume cursor

### `GET /api/responses?checkId=`

```json
{
  "participantId": "…",
  "answerCount": 12,
  "requiredCount": 96,
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

Own answers only. Cursor algorithm: [FLOWS.md](./FLOWS.md) §4.

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
  "answer": ["public_school", "private_school"],
  "importance": 4,
  "hardLine": false
}
```

Rules:

- One question code per request (parent **or** follow-up)
- `hardLine` only if `importance >= 4`; else forced `false`
- Follow-up rows: `CP07F` required when parent `CP07` ∈ {4,5}; `MO04F` when parent `MO04` ∈ {3,4,5}
- Encrypt `{ answer }` only with check DEK
- Idempotent upsert on `(participant_id, question_id)`
- Reject complete while required follow-ups missing

---

## 7. Reveal / discussed

Unchanged state machine: `none` → `requested_by_a|b` → `mutual` (irreversible).  
Discussed sets `result_items.discussed_at`.

---

## 8. Checkout, return URL, webhooks

`POST /api/checks/:id/checkout` → `{ url }`  
Session `success_url` / `cancel_url`: [FLOWS.md](./FLOWS.md) §6.

`GET /api/checks/:id/checkout/status?session_id=` → `{ stripeStatus, checkStatus }` — **never** unlocks.

`POST /api/stripe/webhook`:

| Event | Effect |
| --- | --- |
| `checkout.session.completed` | Pay + unlock; idempotent on session id |
| `charge.refunded` (full / MVP any) | `payment_status=refunded`; re-lock check to teaser; keep results rows |
| `checkout.session.expired` | No status change |

Do **not** unlock on client return alone. Success page polls until `unlocked` or timeout.

---

## 9. Calculate

`POST /api/assessment/complete` (second completer) and `POST /api/checks/:id/calculate`:

- `SELECT checks FOR UPDATE`
- Insert `results` with `ON CONFLICT (check_id) DO NOTHING`
- On insert: write `result_items`, `category_scores`, set `checks.status=ready`
- If row already exists: return existing summary; no recompute

---

## 10. Account export

`GET /api/account/export` → `Content-Disposition: attachment; filename="unsaid-export.json"`  
Contents: [FLOWS.md](./FLOWS.md) §10. Own answers only.

---

## 11. Retake / accept abuse / rate limits / analytics

See prior sections + [FLOWS.md](./FLOWS.md). Analytics allowlist unchanged (first-party table only).

---

## 12. Health

`GET /api/health` must use `getDatabase()` from `@netlify/database` inside the Route Handler on a real Netlify deploy (Phase 0 proof).
