# Unsaid — Data Model (MVP)

Companion to `IMPLEMENTATION_PLAN.md`. Schema names are definitive for Phase 0 migrations.

## Auth-linked

### `profiles`
| Column | Type | Notes |
| --- | --- | --- |
| user_id | uuid PK → auth.users | |
| first_name | text not null | |
| preferred_name | text | optional |
| pronouns | text | optional |
| age_confirmed_18 | boolean not null | |
| created_at | timestamptz | |
| deleted_at | timestamptz | soft delete |

## Checks

### `checks`
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| status | text | created \| active \| awaiting_partner \| ready \| unlocked \| expired \| deleted |
| question_set_version | text | e.g. `2026.09` |
| relationship_stage | text | seriously_dating \| discussing_engagement \| engaged \| wedding_scheduled \| other |
| wedding_date | date | optional |
| created_by | uuid → auth.users | |
| created_at | timestamptz | |
| expires_at | timestamptz | invite/check TTL |
| unlocked_at | timestamptz | |
| payment_status | text | unpaid \| paid \| refunded |
| algorithm_version | text | set when results generated |
| encrypted_dek | bytea | wrapped per-check data key |
| last_activity_at | timestamptz | retention job |

### `check_participants`
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid FK | |
| user_id | uuid FK | |
| role | text | `A` \| `B` |
| first_name_snapshot | text | frozen display name |
| joined_at | timestamptz | |
| completed_at | timestamptz | |
| answer_count | int default 0 | denormalized progress |

**Constraints:** unique `(check_id, user_id)` · max 2 rows per check (enforced in Function + trigger).

### `invitations`
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid FK | |
| token_hash | text unique | never store raw token |
| expires_at | timestamptz | 30 days |
| accepted_at | timestamptz | |
| created_at | timestamptz | |

Single active invitation per check for MVP. Once B begins answering, A cannot replace partner.

## Questions

### `questions`
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| code | text | e.g. `MC01` |
| section | text | |
| text | text | |
| intro | text | optional section/question intro |
| response_type | text | AG5 \| YN3 \| ORD \| CAT \| MULTI |
| response_options | jsonb | |
| compatibility_matrix | jsonb | CAT / specials |
| parent_code | text | follow-ups |
| version | text | question_set_version |
| display_order | int | |
| active | boolean | |
| prompts | jsonb | 3–4 conversation prompts |
| neutral_description | text | |

Unique `(code, version)`.

## Private answers

### `private.responses`
Accessible only via service role from Netlify Functions.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid | |
| participant_id | uuid | |
| question_id | uuid | |
| ciphertext | bytea | AES-256-GCM payload |
| iv | bytea | |
| auth_tag | bytea | |
| importance | smallint | 1–5 (also outside ciphertext for scoring ops—or keep inside; prefer outside for indexing? **Keep outside** for scoring without decrypt of all fields separately; answer value stays encrypted) |
| hard_line | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique `(participant_id, question_id)`.

**Encrypted JSON payload:** `{ answer: ..., followUp?: ... }` only. Importance/hard_line stored as columns for scoring efficiency; still never returned to partner clients.

## Results

### `results`
| Column | Type | Notes |
| --- | --- | --- |
| check_id | uuid PK | |
| algorithm_version | text | e.g. `1.0.0` |
| question_set_version | text | |
| alignment_index | numeric | |
| aligned_count | int | |
| minor_count | int | |
| conversation_count | int | |
| major_count | int | |
| hard_line_collision_count | int | |
| category_scores | jsonb | |
| generated_at | timestamptz | |

### `result_items`
| Column | Type | Notes |
| --- | --- | --- |
| check_id | uuid | |
| question_id | uuid | |
| distance | numeric | |
| impact | numeric | |
| classification | text | aligned \| slight \| conversation \| major \| major_conversation |
| hard_line_collision | boolean | |
| category | text | |
| discussed_at | timestamptz | |
| sort_rank | int | |

No answer columns.

### `reveals`
| Column | Type | Notes |
| --- | --- | --- |
| check_id | uuid | |
| question_id | uuid | |
| status | text | none \| requested_by_a \| requested_by_b \| mutual |
| participant_a_consent | boolean | |
| participant_b_consent | boolean | |
| revealed_at | timestamptz | irreversible |

## Payments

### `payments`
| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| check_id | uuid | |
| purchasing_user_id | uuid | |
| stripe_checkout_session | text | |
| stripe_payment_intent | text | |
| amount | int | cents · 2900 |
| currency | text | usd |
| status | text | |
| product_version | text | |
| created_at | timestamptz | |

## Operational

### `reminder_log`
`(check_id, sender_user_id, sent_at)` for 24h throttle.

### `deletion_queue`
Encrypted blobs scheduled for purge after check/account delete.

## RLS principles

- Participants may `select` their own check membership and non-sensitive check metadata.
- Only own participant row is writable by the user (via Functions preferred).
- `results` / `result_items` readable by participants only when `checks.status = unlocked` (or `ready` for locked teaser fields only—conversation **count** may show on ready; item details locked).
- `private.responses`: no grants to `authenticated` / `anon`.
- Invitations: no client read of `token_hash`.

Prefer **all writes through Netlify Functions** using service role after JWT verification, keeping RLS as defense in depth for any accidental client access.
