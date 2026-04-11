-- =============================================================================
-- SPEC-002: Initial Schema — Halvy
-- Date: 2026-04-11
-- Based on: schema.md v5.0, api-contracts.md, ai-integration.md
-- Tables: users, groups, group_members, placeholders, expenses, line_items,
--         line_item_splits, payments, messages, mentions, message_reactions,
--         standing_orders, notifications, group_invites, rate_limits, ai_budget
-- Enums: 7
-- =============================================================================

-- ============ EXTENSIONS ============

-- moddatetime: auto-update updated_at columns
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- pg_cron: scheduled job execution (standing order execution logic is Phase 5)
-- The extension is enabled here; the cron job body will be implemented in SPEC-Phase5.
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- ============ ENUMS ============

CREATE TYPE group_type AS ENUM ('dinner', 'trip', 'house');

CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');

CREATE TYPE expense_entry_method AS ENUM ('manual', 'ocr', 'voice', 'standing_order');

CREATE TYPE message_type AS ENUM (
  'user_text',
  'expense_card',
  'system_event',
  'expense_reply'
);

CREATE TYPE notification_type AS ENUM (
  'expense_added',
  'expense_edited',
  'expense_deleted',
  'payment_recorded',
  'mention',
  'item_reassigned',
  'standing_order_fired',
  'standing_order_failed',
  'placeholder_claim_available',
  'group_invite'
);

CREATE TYPE recurrence_unit AS ENUM ('day', 'week', 'month', 'year');

CREATE TYPE standing_order_split_mode AS ENUM ('fixed', 'collaborative');


-- ============ TABLES ============
-- Created in FK-dependency order:
-- users → groups → group_members → placeholders → expenses → line_items
-- → line_item_splits → payments → messages → mentions → message_reactions
-- → standing_orders → notifications → group_invites → rate_limits → ai_budget

-- ----------------------------------------------------------------------------
-- 1. users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  auth_provider TEXT NOT NULL, -- 'google' | 'apple' | 'magic_link'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 2. groups
-- ----------------------------------------------------------------------------
CREATE TABLE groups (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  avatar_url               TEXT,
  group_type               group_type NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'USD',
  owner_id                 UUID NOT NULL REFERENCES users(id),
  assignment_timeout_hours INTEGER NOT NULL DEFAULT 24,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 3. group_members
-- NOTE: one_owner_per_group is a partial unique INDEX (not inline CONSTRAINT)
--       because PostgreSQL requires the CREATE UNIQUE INDEX ... WHERE syntax.
--       See the INDEXES section below for the definition.
-- ----------------------------------------------------------------------------
CREATE TABLE group_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  placeholder_id UUID, -- FK to placeholders added after that table is created (see ALTER below)
  role           member_role NOT NULL DEFAULT 'member',
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT member_xor_placeholder CHECK (
    (user_id IS NOT NULL AND placeholder_id IS NULL) OR
    (user_id IS NULL AND placeholder_id IS NOT NULL)
  ),
  CONSTRAINT unique_user_group UNIQUE (group_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 4. placeholders
-- ----------------------------------------------------------------------------
CREATE TABLE placeholders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  display_name       TEXT NOT NULL,
  phone              TEXT,
  email              TEXT,
  claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Back-fill the FK from group_members → placeholders now that placeholders exists
ALTER TABLE group_members
  ADD CONSTRAINT group_members_placeholder_id_fkey
  FOREIGN KEY (placeholder_id) REFERENCES placeholders(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 5. expenses
-- (messages table referenced by expenses via message_id is created later;
--  standing_orders referenced by standing_order_id is also created later.
--  These FKs are added via ALTER TABLE after those tables are created.)
-- ----------------------------------------------------------------------------
CREATE TABLE expenses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id             UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  payer_user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  payer_placeholder_id UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  total_amount         NUMERIC(12, 2) NOT NULL,
  currency             TEXT NOT NULL,
  entry_method         expense_entry_method NOT NULL DEFAULT 'manual',
  receipt_image_url    TEXT,
  message_id           UUID,             -- FK added after messages table (see ALTER below)
  standing_order_id    UUID,             -- FK added after standing_orders table (see ALTER below)
  idempotency_key      TEXT UNIQUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,

  CONSTRAINT payer_xor_placeholder CHECK (
    (payer_user_id IS NOT NULL AND payer_placeholder_id IS NULL) OR
    (payer_user_id IS NULL AND payer_placeholder_id IS NOT NULL)
  )
);

-- ----------------------------------------------------------------------------
-- 6. line_items
-- ----------------------------------------------------------------------------
CREATE TABLE line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id    UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  amount        NUMERIC(12, 2) NOT NULL,
  is_tax        BOOLEAN NOT NULL DEFAULT false,
  is_tip        BOOLEAN NOT NULL DEFAULT false,
  ocr_confidence NUMERIC(3, 2),
  position      INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. line_item_splits
-- ----------------------------------------------------------------------------
CREATE TABLE line_item_splits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id   UUID NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
  expense_id     UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  placeholder_id UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  amount         NUMERIC(12, 2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT line_split_xor_placeholder CHECK (
    (user_id IS NOT NULL AND placeholder_id IS NULL) OR
    (user_id IS NULL AND placeholder_id IS NOT NULL)
  )
);

-- ----------------------------------------------------------------------------
-- 8. payments
-- (message_id FK added after messages table is created)
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  from_placeholder_id UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  to_user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  to_placeholder_id   UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  amount              NUMERIC(12, 2) NOT NULL,
  currency            TEXT NOT NULL,
  note                TEXT,
  message_id          UUID,           -- FK added after messages table (see ALTER below)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT payment_from_xor_placeholder CHECK (
    (from_user_id IS NOT NULL AND from_placeholder_id IS NULL) OR
    (from_user_id IS NULL AND from_placeholder_id IS NOT NULL)
  ),
  CONSTRAINT payment_to_xor_placeholder CHECK (
    (to_user_id IS NOT NULL AND to_placeholder_id IS NULL) OR
    (to_user_id IS NULL AND to_placeholder_id IS NOT NULL)
  )
);

-- ----------------------------------------------------------------------------
-- 9. messages
-- (expense_id and payment_id reference tables already created)
-- ----------------------------------------------------------------------------
CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  message_type     message_type NOT NULL,
  body             TEXT,
  expense_id       UUID REFERENCES expenses(id) ON DELETE SET NULL,
  payment_id       UUID REFERENCES payments(id) ON DELETE SET NULL,
  parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

-- Back-fill FK: expenses.message_id → messages
ALTER TABLE expenses
  ADD CONSTRAINT expenses_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Back-fill FK: payments.message_id → messages
ALTER TABLE payments
  ADD CONSTRAINT payments_message_id_fkey
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 10. mentions
-- ----------------------------------------------------------------------------
CREATE TABLE mentions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  group_id          UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, mentioned_user_id)
);

-- ----------------------------------------------------------------------------
-- 11. message_reactions
-- ----------------------------------------------------------------------------
CREATE TABLE message_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- ----------------------------------------------------------------------------
-- 12. standing_orders
-- ----------------------------------------------------------------------------
CREATE TABLE standing_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id             UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  payer_user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  total_amount         NUMERIC(12, 2) NOT NULL,
  -- Custom recurrence: e.g. every 2 weeks = recurrence_every=2, recurrence_unit='week'
  recurrence_every     INTEGER NOT NULL CHECK (recurrence_every > 0),
  recurrence_unit      recurrence_unit NOT NULL,
  -- Split mode chosen at creation
  split_mode           standing_order_split_mode NOT NULL DEFAULT 'collaborative',
  -- split_rule is JSONB, used only when split_mode = 'fixed'. NULL for collaborative.
  split_rule           JSONB,
  -- Scheduling
  first_run_at         TIMESTAMPTZ NOT NULL,
  next_run_at          TIMESTAMPTZ NOT NULL,
  last_run_at          TIMESTAMPTZ,
  -- Failure tracking
  last_error           TEXT,
  last_error_at        TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fixed_split_requires_rule CHECK (
    split_mode = 'collaborative' OR split_rule IS NOT NULL
  )
);

-- Back-fill FK: expenses.standing_order_id → standing_orders
ALTER TABLE expenses
  ADD CONSTRAINT expenses_standing_order_id_fkey
  FOREIGN KEY (standing_order_id) REFERENCES standing_orders(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 13. notifications
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id          UUID REFERENCES groups(id) ON DELETE CASCADE,
  expense_id        UUID REFERENCES expenses(id) ON DELETE SET NULL,
  payment_id        UUID REFERENCES payments(id) ON DELETE SET NULL,
  message_id        UUID REFERENCES messages(id) ON DELETE SET NULL,
  notification_type notification_type NOT NULL,
  body              TEXT NOT NULL,
  is_read           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 14. group_invites (from api-contracts.md)
-- ----------------------------------------------------------------------------
CREATE TABLE group_invites (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  token              TEXT NOT NULL UNIQUE,  -- 8-char alphanumeric, generated by application
  expires_at         TIMESTAMPTZ NOT NULL,  -- 7 days from creation
  used_at            TIMESTAMPTZ,           -- soft-consume; row kept for audit
  used_by_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 15. rate_limits (from api-contracts.md)
-- ----------------------------------------------------------------------------
CREATE TABLE rate_limits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id     UUID REFERENCES groups(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  call_count   INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, action, window_start)
);

-- ----------------------------------------------------------------------------
-- 16. ai_budget (from ai-integration.md Section 8.2)
-- ----------------------------------------------------------------------------
CREATE TABLE ai_budget (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key      TEXT NOT NULL,            -- e.g. '2025-07'
  total_calls    INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
  budget_limit   NUMERIC(10, 2) NOT NULL,  -- set via env var in Edge Function
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month_key)
);
