-- Unsaid MVP initial schema (docs/DATA_MODEL.md, docs/E2E_LOCKS.md)
-- All timestamps are UTC. wedding_date is a bare DATE with no timezone.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  email text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  preferred_name text,
  pronouns text,
  age_confirmed_18 boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- checks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'awaiting_partner',
  question_set_version text NOT NULL,
  relationship_stage text NOT NULL,
  wedding_date date,
  partner_first_name_pending text,
  created_by_profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  unlocked_at timestamptz,
  payment_status text NOT NULL DEFAULT 'unpaid',
  algorithm_version text,
  encrypted_dek bytea,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT checks_status_check CHECK (
    status IN ('awaiting_partner', 'active', 'ready', 'unlocked', 'expired', 'deleted')
  ),
  CONSTRAINT checks_payment_status_check CHECK (
    payment_status IN ('unpaid', 'paid', 'refunded')
  ),
  CONSTRAINT checks_relationship_stage_check CHECK (
    relationship_stage IN (
      'seriously_dating',
      'discussing_engagement',
      'engaged',
      'wedding_scheduled',
      'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS checks_created_by_idx ON checks (created_by_profile_id);
CREATE INDEX IF NOT EXISTS checks_status_activity_idx ON checks (status, last_activity_at);

-- ---------------------------------------------------------------------------
-- check_participants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS check_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES checks (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role text NOT NULL,
  first_name_snapshot text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  answer_count int NOT NULL DEFAULT 0,
  -- Maintained at write time so partner progress never needs a decrypt
  -- (E2E_LOCKS §4). required_count = 96 primaries + triggered follow-ups.
  required_count int NOT NULL DEFAULT 96,
  follow_ups_required text[] NOT NULL DEFAULT '{}',
  CONSTRAINT check_participants_role_check CHECK (role IN ('A', 'B'))
);

CREATE UNIQUE INDEX IF NOT EXISTS check_participants_check_profile_uniq
  ON check_participants (check_id, profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS check_participants_check_role_uniq
  ON check_participants (check_id, role);
CREATE INDEX IF NOT EXISTS check_participants_profile_idx
  ON check_participants (profile_id);

-- ---------------------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES checks (id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  partner_first_name_pending text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz
);

CREATE INDEX IF NOT EXISTS invitations_check_idx ON invitations (check_id);

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  question_set_version text NOT NULL,
  section_id text NOT NULL,
  prompt text NOT NULL,
  response_type text NOT NULL,
  options jsonb,
  compatibility_matrix jsonb,
  parent_code text,
  show_when jsonb,
  distance_mode text,
  special_scoring text,
  display_order numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  conversation_prompts jsonb,
  neutral_description text,
  tone_note text,
  CONSTRAINT questions_response_type_check CHECK (
    response_type IN ('AG5', 'YN3', 'ORD', 'CAT', 'MULTI')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS questions_code_version_uniq
  ON questions (code, question_set_version);
CREATE INDEX IF NOT EXISTS questions_version_order_idx
  ON questions (question_set_version, section_id, display_order);

-- ---------------------------------------------------------------------------
-- responses (sensitive; server-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES checks (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES check_participants (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions (id),
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL,
  auth_tag bytea NOT NULL,
  importance smallint NOT NULL,
  hard_line boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT responses_importance_check CHECK (importance BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS responses_participant_question_uniq
  ON responses (participant_id, question_id);
CREATE INDEX IF NOT EXISTS responses_check_idx ON responses (check_id);

-- ---------------------------------------------------------------------------
-- results (PK on check_id == calculate idempotency)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
  check_id uuid PRIMARY KEY REFERENCES checks (id) ON DELETE CASCADE,
  algorithm_version text NOT NULL,
  question_set_version text NOT NULL,
  alignment_index numeric NOT NULL,
  aligned_count int NOT NULL DEFAULT 0,
  minor_count int NOT NULL DEFAULT 0,
  conversation_count int NOT NULL DEFAULT 0,
  major_count int NOT NULL DEFAULT 0,
  hard_line_collision_count int NOT NULL DEFAULT 0,
  teaser_conversation_count int NOT NULL DEFAULT 0,
  category_scores jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- result_items (never stores answers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS result_items (
  check_id uuid NOT NULL REFERENCES checks (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions (id),
  distance numeric NOT NULL,
  impact numeric NOT NULL,
  classification text NOT NULL,
  hard_line_collision boolean NOT NULL DEFAULT false,
  category text NOT NULL,
  discussed_at timestamptz,
  sort_rank int NOT NULL,
  CONSTRAINT result_items_classification_check CHECK (
    classification IN ('aligned', 'slight', 'conversation', 'major', 'major_conversation')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS result_items_check_question_uniq
  ON result_items (check_id, question_id);
CREATE INDEX IF NOT EXISTS result_items_check_rank_idx
  ON result_items (check_id, sort_rank);

-- ---------------------------------------------------------------------------
-- reveals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reveals (
  check_id uuid NOT NULL REFERENCES checks (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions (id),
  status text NOT NULL DEFAULT 'none',
  participant_a_consent boolean NOT NULL DEFAULT false,
  participant_b_consent boolean NOT NULL DEFAULT false,
  revealed_at timestamptz,
  CONSTRAINT reveals_status_check CHECK (
    status IN ('none', 'requested_by_a', 'requested_by_b', 'mutual')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS reveals_check_question_uniq
  ON reveals (check_id, question_id);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES checks (id) ON DELETE CASCADE,
  purchasing_clerk_user_id text NOT NULL,
  stripe_checkout_session text UNIQUE,
  stripe_payment_intent text,
  amount int NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL,
  product_version text,
  session_expires_at timestamptz,
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_status_check CHECK (
    status IN ('open', 'paid', 'refunded', 'expired')
  )
);

-- At most one open|paid payment row per check (E2E_LOCKS §7).
CREATE UNIQUE INDEX IF NOT EXISTS payments_check_active_uniq
  ON payments (check_id)
  WHERE status IN ('open', 'paid');

CREATE INDEX IF NOT EXISTS payments_check_idx ON payments (check_id);

-- ---------------------------------------------------------------------------
-- reminder_log (24h throttle)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES checks (id) ON DELETE CASCADE,
  sender_profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminder_log_check_sender_idx
  ON reminder_log (check_id, sender_profile_id, sent_at DESC);

-- ---------------------------------------------------------------------------
-- rate_limits (E2E_LOCKS §13)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  CONSTRAINT rate_limits_pk PRIMARY KEY (bucket, subject, window_start)
);

-- ---------------------------------------------------------------------------
-- analytics_events (allowlisted event names only — E2E_LOCKS §11)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  profile_id uuid REFERENCES profiles (id) ON DELETE SET NULL,
  check_id uuid,
  role text,
  section_index int,
  source text,
  value numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_name_check CHECK (
    event_name IN (
      'landing_viewed',
      'start_clicked',
      'check_created',
      'invite_sent',
      'partner_joined',
      'assessment_started',
      'section_completed',
      'assessment_completed',
      'check_ready',
      'checkout_started',
      'checkout_completed',
      'results_viewed',
      'conversation_opened',
      'reveal_requested',
      'reveal_completed',
      'check_deleted',
      'retake_started',
      'share_tapped',
      'account_exported',
      'account_deleted'
    )
  ),
  CONSTRAINT analytics_events_section_index_check CHECK (
    section_index IS NULL OR section_index BETWEEN 0 AND 11
  )
);

CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx
  ON analytics_events (event_name, created_at DESC);

-- ---------------------------------------------------------------------------
-- deletion_queue (purge after check/account delete or Clerk user.deleted)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deletion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  reason text NOT NULL,
  payload jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT deletion_queue_subject_type_check CHECK (
    subject_type IN ('check', 'profile', 'clerk_user')
  )
);

CREATE INDEX IF NOT EXISTS deletion_queue_pending_idx
  ON deletion_queue (processed_at, purge_after);
