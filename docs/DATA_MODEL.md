# Unsaid — Data Model (MVP)

Companion to [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

**Database:** Netlify Database (Postgres) via `@netlify/database`  
**Migrations:** `netlify/database/migrations/<number>_<slug>/migration.sql`  
**Auth key:** `profiles.clerk_user_id` (Clerk user id string)

All response/result/payment writes happen in Next.js Route Handlers / Server Actions after `await auth()`. No browser DB access.

---

## profiles

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| clerk_user_id | text UNIQUE NOT NULL | Clerk `user_…` |
| email | text NOT NULL | denormalized from Clerk for support/ops |
| first_name | text NOT NULL | |
| preferred_name | text | optional |
| pronouns | text | optional |
| age_confirmed_18 | boolean NOT NULL | |
| created_at | timestamptz DEFAULT now() | |
| deleted_at | timestamptz | soft delete |

---

## checks

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| status | text NOT NULL | created \| active \| awaiting_partner \| ready \| unlocked \| expired \| deleted |
| question_set_version | text NOT NULL | e.g. `2026.09` |
| relationship_stage | text NOT NULL | |
| wedding_date | date | optional |
| created_by_profile_id | uuid NOT NULL → profiles | |
| created_at | timestamptz | |
| expires_at | timestamptz | |
| unlocked_at | timestamptz | |
| payment_status | text NOT NULL DEFAULT `unpaid` | unpaid \| paid \| refunded — refunded re-locks API to teaser |
| algorithm_version | text | set when results generated |
| encrypted_dek | bytea | wrapped per-check data key |
| last_activity_at | timestamptz | retention |

---

## check_participants

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid NOT NULL → checks | |
| profile_id | uuid NOT NULL → profiles | |
| role | text NOT NULL | `A` \| `B` |
| first_name_snapshot | text NOT NULL | |
| joined_at | timestamptz | |
| completed_at | timestamptz | |
| answer_count | int NOT NULL DEFAULT 0 | |

**Constraints:** UNIQUE `(check_id, profile_id)` · UNIQUE `(check_id, role)` · max 2 participants enforced in app + CHECK/trigger.

---

## invitations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid NOT NULL → checks | |
| token_hash | text UNIQUE NOT NULL | never store raw token |
| expires_at | timestamptz NOT NULL | 30 days |
| accepted_at | timestamptz | |
| created_at | timestamptz | |

---

## questions

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| code | text NOT NULL | e.g. `MC01` |
| section | text NOT NULL | |
| text | text NOT NULL | |
| intro | text | |
| response_type | text NOT NULL | AG5 \| YN3 \| ORD \| CAT \| MULTI |
| response_options | jsonb | |
| compatibility_matrix | jsonb | |
| parent_code | text | follow-ups |
| version | text NOT NULL | question_set_version |
| display_order | int NOT NULL | |
| active | boolean NOT NULL DEFAULT true | |
| prompts | jsonb | 3–4 conversation prompts |
| neutral_description | text | |

UNIQUE `(code, version)`.

---

## responses

Sensitive. Server-only.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid NOT NULL | |
| participant_id | uuid NOT NULL → check_participants | |
| question_id | uuid NOT NULL → questions | |
| ciphertext | bytea NOT NULL | AES-256-GCM of `{ answer, followUp? }` |
| iv | bytea NOT NULL | |
| auth_tag | bytea NOT NULL | |
| importance | smallint NOT NULL | 1–5 |
| hard_line | boolean NOT NULL DEFAULT false | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

UNIQUE `(participant_id, question_id)`.

Importance/hard_line stored as columns for scoring; answer value stays encrypted.

---

## results

| Column | Type | Notes |
| --- | --- | --- |
| check_id | uuid PK → checks | **PK = idempotency** — concurrent calculate uses `ON CONFLICT DO NOTHING` |
| algorithm_version | text NOT NULL | e.g. `1.0.0` |
| question_set_version | text NOT NULL | |
| alignment_index | numeric NOT NULL | |
| aligned_count | int NOT NULL | |
| minor_count | int NOT NULL | |
| conversation_count | int NOT NULL | |
| major_count | int NOT NULL | |
| hard_line_collision_count | int NOT NULL | |
| category_scores | jsonb | `[{ sectionId, label, alignmentIndex }]` for results “By topic” |
| generated_at | timestamptz | |

Calculate path: `SELECT checks FOR UPDATE` then insert results. Never silently recompute. Refunds re-lock access but **do not delete** this row.

---

## result_items

| Column | Type | Notes |
| --- | --- | --- |
| check_id | uuid NOT NULL | |
| question_id | uuid NOT NULL | |
| distance | numeric NOT NULL | |
| impact | numeric NOT NULL | |
| classification | text NOT NULL | aligned \| slight \| conversation \| major \| major_conversation |
| hard_line_collision | boolean NOT NULL | |
| category | text NOT NULL | |
| discussed_at | timestamptz | |
| sort_rank | int NOT NULL | |

No answer columns.

---

## reveals

| Column | Type | Notes |
| --- | --- | --- |
| check_id | uuid NOT NULL | |
| question_id | uuid NOT NULL | |
| status | text NOT NULL | none \| requested_by_a \| requested_by_b \| mutual |
| participant_a_consent | boolean NOT NULL DEFAULT false | |
| participant_b_consent | boolean NOT NULL DEFAULT false | |
| revealed_at | timestamptz | irreversible |

UNIQUE `(check_id, question_id)`.

---

## payments

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid NOT NULL | |
| purchasing_clerk_user_id | text NOT NULL | |
| stripe_checkout_session | text | |
| stripe_payment_intent | text | |
| amount | int NOT NULL | cents · 2900 |
| currency | text NOT NULL DEFAULT `usd` | |
| status | text NOT NULL | |
| product_version | text | |
| created_at | timestamptz | |

---

## Operational

### reminder_log
`(check_id, sender_profile_id, sent_at)` — enforce 24h throttle.

### rate_limits
| Column | Type | Notes |
| --- | --- | --- |
| bucket | text | e.g. `invite_create`, `checkout` |
| subject | text | profile id / check id / ip hash |
| window_start | timestamptz | |
| count | int | |

UNIQUE `(bucket, subject, window_start)`.

### analytics_events
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| event_name | text | allowlist only — see API_CONTRACT §12 |
| profile_id | uuid | nullable |
| check_id | uuid | nullable opaque |
| props | jsonb | scrubbed; no answers/topics |
| created_at | timestamptz | |

### deletion_queue
Encrypted blobs / row references scheduled for purge after check/account delete or Clerk `user.deleted`.

### Follow-ups
Bank codes `CP07F` / `MO04F` are rows in `questions` with `parent_code`. Responses store follow-up answers as **separate rows** on the follow-up `question_id`. Parent ciphertext is scalar AG5 only — never embed MULTI/ORD follow-up arrays in the parent payload.

### Offline / client
No server table. Client IndexedDB queue per [FLOWS.md](./FLOWS.md) §7.

### Account export
No separate table — `GET /api/account/export` assembles JSON from profile, checks, own responses (decrypt), payments.

---

## Migration starter sketch

```sql
-- netlify/database/migrations/001_init/migration.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  email text NOT NULL,
  first_name text NOT NULL,
  preferred_name text,
  pronouns text,
  age_confirmed_18 boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- additional tables follow in same or subsequent migrations
```

Apply order is lexicographic by folder name. Production applies before publish; failure blocks deploy.
