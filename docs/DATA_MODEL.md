# Unsaid — Data Model (MVP)

Companion to [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).  
**Conflict rule:** [E2E_LOCKS.md](./E2E_LOCKS.md) wins.

**Database:** Netlify Database (Postgres) via `@netlify/database`  
**Migrations:** `netlify/database/migrations/<number>_<slug>/migration.sql` (lexical apply order)  
**Auth key:** `profiles.clerk_user_id`

All response/result/payment writes happen server-side after `await auth()`. No browser DB access.

---

## profiles

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| clerk_user_id | text UNIQUE NOT NULL | Clerk `user_…` |
| email | text NOT NULL | denormalized from Clerk |
| first_name | text NOT NULL | |
| preferred_name | text | optional |
| pronouns | text | optional |
| age_confirmed_18 | boolean NOT NULL | |
| created_at | timestamptz DEFAULT now() | UTC |
| deleted_at | timestamptz | soft delete |

---

## checks

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| status | text NOT NULL | `awaiting_partner` \| `active` \| `ready` \| `unlocked` \| `expired` \| `deleted` — transitions E2E_LOCKS §2 |
| question_set_version | text NOT NULL | e.g. `2026.09` |
| relationship_stage | text NOT NULL | enum slugs E2E_LOCKS §1 |
| wedding_date | date | optional; bare date, no TZ |
| partner_first_name_pending | text | until B joins |
| created_by_profile_id | uuid NOT NULL → profiles | |
| created_at | timestamptz | UTC |
| expires_at | timestamptz | UTC |
| unlocked_at | timestamptz | |
| payment_status | text NOT NULL DEFAULT `unpaid` | unpaid \| paid \| refunded — refunded re-locks API to teaser |
| algorithm_version | text | set when results generated |
| encrypted_dek | bytea | layout: `iv(12) \|\| tag(16) \|\| ciphertext` of DEK (E2E_LOCKS §6) |
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
| answer_count | int NOT NULL DEFAULT 0 | saved required responses; used for progress % |

**Constraints:** UNIQUE `(check_id, profile_id)` · UNIQUE `(check_id, role)` · max 2 participants.

---

## invitations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid NOT NULL → checks | |
| token_hash | text UNIQUE NOT NULL | never store raw token |
| partner_first_name_pending | text NOT NULL | |
| expires_at | timestamptz NOT NULL | 30 days UTC |
| accepted_at | timestamptz | |
| created_at | timestamptz | |
| invalidated_at | timestamptz | set when invite replaced |

---

## questions

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| code | text NOT NULL | e.g. `MC01`, `CP07F` |
| section | text NOT NULL | |
| prompt | text NOT NULL | from JSON `text` |
| response_type | text NOT NULL | AG5 \| ORD \| CAT \| MULTI |
| options | jsonb | |
| compatibility_matrix | jsonb | |
| parent_code | text | follow-ups |
| show_when | jsonb | from `followUpWhen` / `hiddenUnlessParent` |
| distance_mode | text | |
| special_scoring | text | |
| version | text NOT NULL | question_set_version |
| display_order | **numeric** NOT NULL | allows `7.1`, `4.1` |
| active | boolean NOT NULL DEFAULT true | |
| conversation_prompts | jsonb | |
| neutral_description | text | |
| tone_note | text | optional |

UNIQUE `(code, version)`. Seed map: **E2E_LOCKS §5**.

---

## responses

Sensitive. Server-only.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid NOT NULL | |
| participant_id | uuid NOT NULL → check_participants | |
| question_id | uuid NOT NULL → questions | |
| ciphertext | bytea NOT NULL | AES-256-GCM of `{ answer }` only |
| iv | bytea NOT NULL | 12 bytes |
| auth_tag | bytea NOT NULL | 16 bytes |
| importance | smallint NOT NULL | 1–5 |
| hard_line | boolean NOT NULL DEFAULT false | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

UNIQUE `(participant_id, question_id)`.

Follow-ups (`CP07F`, `MO04F`) = **separate rows**.

---

## results

| Column | Type | Notes |
| --- | --- | --- |
| check_id | uuid PK → checks | PK = calculate idempotency |
| algorithm_version | text NOT NULL | |
| question_set_version | text NOT NULL | |
| alignment_index | numeric NOT NULL | |
| aligned_count | int NOT NULL | |
| minor_count | int NOT NULL | from `slight` |
| conversation_count | int NOT NULL | classification `conversation` only |
| major_count | int NOT NULL | `major` + `major_conversation` |
| hard_line_collision_count | int NOT NULL | |
| teaser_conversation_count | int NOT NULL | conversation+major+major_conversation (E2E_LOCKS §8) |
| category_scores | jsonb | `[{ sectionId, label, alignmentIndex }]` |
| generated_at | timestamptz | |

Calculate: `SELECT checks FOR UPDATE` then insert. Refunds re-lock access; **do not delete** this row.

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

No answer columns. UNIQUE `(check_id, question_id)`.

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
| stripe_checkout_session | text UNIQUE | |
| stripe_payment_intent | text | |
| amount | int NOT NULL | cents · 2900 |
| currency | text NOT NULL DEFAULT `usd` | |
| status | text NOT NULL | `open` \| `paid` \| `refunded` \| `expired` |
| product_version | text | |
| created_at | timestamptz | |

Partial unique index: at most one row per `check_id` where `status IN ('open','paid')`.

---

## Operational

### reminder_log
`(check_id, sender_profile_id, sent_at)` — 24h throttle.

### rate_limits
`(bucket, subject, window_start, count)` — E2E_LOCKS §13.

### analytics_events
Allowlist event names only — E2E_LOCKS §11.

### deletion_queue
Encrypted blobs / row refs for purge after delete or Clerk `user.deleted`.

---

## Migration starter

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
```
