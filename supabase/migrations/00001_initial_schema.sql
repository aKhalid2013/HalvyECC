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
  phone         TEXT UNIQUE,
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


-- ============ INDEXES ============

CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id  ON group_members(user_id);

CREATE INDEX idx_expenses_group_id   ON expenses(group_id);
CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_line_item_splits_expense_id   ON line_item_splits(expense_id);
CREATE INDEX idx_line_item_splits_line_item_id ON line_item_splits(line_item_id);
CREATE INDEX idx_line_item_splits_user_id      ON line_item_splits(user_id);

CREATE INDEX idx_payments_group_id   ON payments(group_id);
CREATE INDEX idx_payments_from_user  ON payments(from_user_id);
CREATE INDEX idx_payments_to_user    ON payments(to_user_id);
CREATE INDEX idx_payments_deleted_at ON payments(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_messages_group_id_created ON messages(group_id, created_at DESC);
CREATE INDEX idx_messages_deleted_at       ON messages(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_mentions_mentioned_user ON mentions(mentioned_user_id);
CREATE INDEX idx_mentions_message_id     ON mentions(message_id);

-- Placeholder claiming lookup
CREATE INDEX idx_placeholders_email ON placeholders(email) WHERE email IS NOT NULL AND claimed_at IS NULL;
CREATE INDEX idx_placeholders_phone ON placeholders(phone) WHERE phone IS NOT NULL AND claimed_at IS NULL;

-- Standing orders due for execution (active only)
CREATE INDEX idx_standing_orders_next_run ON standing_orders(next_run_at) WHERE is_active = true;

CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);

-- Partial unique index for group ownership (one owner per group)
CREATE UNIQUE INDEX one_owner_per_group ON group_members(group_id) WHERE role = 'owner';


-- ============ TRIGGER FUNCTIONS ============

-- 1. fn_balance_broadcast
-- Broadcasts a notification to the Realtime channel 'balances:{group_id}'
CREATE OR REPLACE FUNCTION fn_balance_broadcast()
RETURNS TRIGGER AS $$
DECLARE
  target_group_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_group_id := OLD.group_id;
  ELSE
    target_group_id := NEW.group_id;
  END IF;

  PERFORM pg_notify(
    'pgrst',
    json_build_object(
      'channel', 'balances:' || target_group_id::text,
      'message', 'recalculate'
    )::text
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. fn_expense_create_msg
-- Inserts system message: "[creator] added [title]"
CREATE OR REPLACE FUNCTION fn_expense_create_msg()
RETURNS TRIGGER AS $$
DECLARE
  creator_name TEXT;
BEGIN
  SELECT display_name INTO creator_name FROM users WHERE id = NEW.creator_user_id;

  INSERT INTO messages (group_id, message_type, body, expense_id, created_at)
  VALUES (
    NEW.group_id,
    'system_event',
    COALESCE(creator_name, 'Someone') || ' added "' || NEW.title || '"',
    NEW.id,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. fn_expense_edit_msg
-- Inserts system message on substantive edits
CREATE OR REPLACE FUNCTION fn_expense_edit_msg()
RETURNS TRIGGER AS $$
DECLARE
  editor_name TEXT;
BEGIN
  -- Only fire if title or total_amount changed and it's not a soft-delete (handled by delete_msg)
  IF (NEW.deleted_at IS NULL AND (OLD.title <> NEW.title OR OLD.total_amount <> NEW.total_amount)) THEN
    INSERT INTO messages (group_id, message_type, body, expense_id, created_at)
    VALUES (
      NEW.group_id,
      'system_event',
      'Expense "' || NEW.title || '" was updated',
      NEW.id,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. fn_expense_delete_msg
-- Inserts system message on soft-delete
CREATE OR REPLACE FUNCTION fn_expense_delete_msg()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    INSERT INTO messages (group_id, message_type, body, expense_id, created_at)
    VALUES (
      NEW.group_id,
      'system_event',
      'Expense "' || NEW.title || '" was deleted',
      NEW.id,
      NEW.deleted_at
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. fn_payment_msg
-- Inserts system message: "[from] paid [to] · $[amount]"
CREATE OR REPLACE FUNCTION fn_payment_msg()
RETURNS TRIGGER AS $$
DECLARE
  from_name TEXT;
  to_name TEXT;
BEGIN
  -- Resolve from_name
  IF NEW.from_user_id IS NOT NULL THEN
    SELECT display_name INTO from_name FROM users WHERE id = NEW.from_user_id;
  ELSE
    SELECT display_name INTO from_name FROM placeholders WHERE id = NEW.from_placeholder_id;
  END IF;

  -- Resolve to_name
  IF NEW.to_user_id IS NOT NULL THEN
    SELECT display_name INTO to_name FROM users WHERE id = NEW.to_user_id;
  ELSE
    SELECT display_name INTO to_name FROM placeholders WHERE id = NEW.to_placeholder_id;
  END IF;

  INSERT INTO messages (group_id, message_type, body, payment_id, created_at)
  VALUES (
    NEW.group_id,
    'system_event',
    COALESCE(from_name, 'Someone') || ' paid ' || COALESCE(to_name, 'Someone') || ' · ' || NEW.currency || ' ' || NEW.amount::text,
    NEW.id,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. fn_owner_transfer
-- Soft-delete of user: reassign groups.owner_id to earliest joined member
CREATE OR REPLACE FUNCTION fn_owner_transfer()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    -- For every group this user owns
    UPDATE groups
    SET owner_id = (
      SELECT user_id
      FROM group_members
      WHERE group_id = groups.id
        AND user_id <> OLD.id
        AND user_id IS NOT NULL
      ORDER BY joined_at ASC
      LIMIT 1
    )
    WHERE owner_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. fn_placeholder_claim_check
-- Matches new user email/phone against unclaimed placeholders
CREATE OR REPLACE FUNCTION fn_placeholder_claim_check()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notifications for any groups where this user matches an unclaimed placeholder
  INSERT INTO notifications (user_id, group_id, notification_type, body)
  SELECT
    NEW.id,
    p.group_id,
    'placeholder_claim_available',
    'You have unclaimed expenses in "' || g.name || '". Tap to claim your history.'
  FROM placeholders p
  JOIN groups g ON g.id = p.group_id
  WHERE (p.email = NEW.email OR (NEW.phone IS NOT NULL AND p.phone = NEW.phone))
    AND p.claimed_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. fn_mention_notification
-- Inserts notification on mention
CREATE OR REPLACE FUNCTION fn_mention_notification()
RETURNS TRIGGER AS $$
DECLARE
  mentioner_name TEXT;
  group_name TEXT;
BEGIN
  SELECT display_name INTO mentioner_name FROM users WHERE id = NEW.mentioner_user_id;
  SELECT name INTO group_name FROM groups WHERE id = NEW.group_id;

  INSERT INTO notifications (user_id, group_id, message_id, notification_type, body)
  VALUES (
    NEW.mentioned_user_id,
    NEW.group_id,
    NEW.message_id,
    'mention',
    COALESCE(mentioner_name, 'Someone') || ' mentioned you in "' || COALESCE(group_name, 'the group') || '"'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. fn_item_reassign_notification
-- Notification when line_item_splits.user_id changes
CREATE OR REPLACE FUNCTION fn_item_reassign_notification()
RETURNS TRIGGER AS $$
DECLARE
  item_desc TEXT;
BEGIN
  IF (OLD.user_id IS NOT NULL AND NEW.user_id IS NOT NULL AND OLD.user_id <> NEW.user_id) THEN
    SELECT description INTO item_desc FROM line_items WHERE id = NEW.line_item_id;

    INSERT INTO notifications (user_id, group_id, expense_id, notification_type, body)
    VALUES (
      NEW.user_id,
      (SELECT group_id FROM expenses WHERE id = NEW.expense_id),
      NEW.expense_id,
      'item_reassigned',
      'A line item ("' || COALESCE(item_desc, 'Unnamed item') || '") was reassigned to you.'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. fn_standing_order_execute (Stub for Phase 5)
CREATE OR REPLACE FUNCTION fn_standing_order_execute()
RETURNS TRIGGER AS $$
BEGIN
  -- Logic deferred to Phase 5.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============ TRIGGERS ============

-- 1. Balance Recalculation Broadcast
CREATE TRIGGER trg_balance_broadcast_expenses
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION fn_balance_broadcast();

CREATE TRIGGER trg_balance_broadcast_payments
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION fn_balance_broadcast();

-- 2. Expense Lifecycle Messages
CREATE TRIGGER trg_expense_create_msg
AFTER INSERT ON expenses
FOR EACH ROW EXECUTE FUNCTION fn_expense_create_msg();

CREATE TRIGGER trg_expense_edit_msg
AFTER UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION fn_expense_edit_msg();

CREATE TRIGGER trg_expense_delete_msg
AFTER UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION fn_expense_delete_msg();

-- 3. Payment Message
CREATE TRIGGER trg_payment_msg
AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION fn_payment_msg();

-- 4. Owner Transfer
CREATE TRIGGER trg_owner_transfer
AFTER UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_owner_transfer();

-- 5. Placeholder Claim Check
CREATE TRIGGER trg_placeholder_claim_check
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION fn_placeholder_claim_check();

-- 6. Mention Notification
CREATE TRIGGER trg_mention_notification
AFTER INSERT ON mentions
FOR EACH ROW EXECUTE FUNCTION fn_mention_notification();

-- 7. Item Reassignment Notification
CREATE TRIGGER trg_item_reassign_notification
AFTER UPDATE ON line_item_splits
FOR EACH ROW EXECUTE FUNCTION fn_item_reassign_notification();


-- ============ MODDATETIME TRIGGERS ============

-- moddatetime triggers for 11 tables with updated_at column

CREATE TRIGGER handle_updated_at_users BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_groups BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_group_members BEFORE UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_placeholders BEFORE UPDATE ON placeholders
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_expenses BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_line_items BEFORE UPDATE ON line_items
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_line_item_splits BEFORE UPDATE ON line_item_splits
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_payments BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_standing_orders BEFORE UPDATE ON standing_orders
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_rate_limits BEFORE UPDATE ON rate_limits
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_ai_budget BEFORE UPDATE ON ai_budget
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime(updated_at);


-- ============ SECURITY HELPERS ============

-- Function to check if a user is a member of a group (SECURITY DEFINER to break RLS recursion)
CREATE OR REPLACE FUNCTION is_member(target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = target_group_id
      AND group_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if a user is an owner or admin of a group
CREATE OR REPLACE FUNCTION is_admin_or_owner(target_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = target_group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============ ROW LEVEL SECURITY ============

-- Enable RLS on all 16 tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE placeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_item_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE standing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_budget ENABLE ROW LEVEL SECURITY;

-- 1. users
CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid());

-- 2. groups
CREATE POLICY "groups_select_members" ON groups FOR SELECT USING (is_member(id));
CREATE POLICY "groups_write_owner_admin" ON groups FOR ALL USING (is_admin_or_owner(id));

-- 3. group_members
CREATE POLICY "group_members_select_visible" ON group_members FOR SELECT USING (is_member(group_id));
CREATE POLICY "group_members_write_owner_admin" ON group_members FOR ALL USING (is_admin_or_owner(group_id));

-- 4. placeholders
CREATE POLICY "placeholders_select_members" ON placeholders FOR SELECT USING (is_member(group_id));
CREATE POLICY "placeholders_insert_members" ON placeholders FOR INSERT WITH CHECK (is_member(group_id));
CREATE POLICY "placeholders_update_owner_admin" ON placeholders FOR UPDATE USING (is_admin_or_owner(group_id));

-- 5. expenses
CREATE POLICY "expenses_select_members" ON expenses FOR SELECT USING (is_member(group_id));
CREATE POLICY "expenses_insert_members" ON expenses FOR INSERT WITH CHECK (is_member(group_id));
CREATE POLICY "expenses_update_members" ON expenses FOR UPDATE USING (is_member(group_id));
CREATE POLICY "expenses_delete_creator_owner_admin" ON expenses FOR DELETE USING (
  creator_user_id = auth.uid() OR is_admin_or_owner(group_id)
);

-- 6. line_items
CREATE POLICY "line_items_select_members" ON line_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = line_items.expense_id AND is_member(e.group_id)
  )
);
CREATE POLICY "line_items_all_members" ON line_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = line_items.expense_id AND is_member(e.group_id)
  )
);

-- 7. line_item_splits
CREATE POLICY "line_item_splits_select_members" ON line_item_splits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = line_item_splits.expense_id AND is_member(e.group_id)
  )
);
CREATE POLICY "line_item_splits_all_members" ON line_item_splits FOR ALL USING (
  EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = line_item_splits.expense_id AND is_member(e.group_id)
  )
);

-- 8. payments
CREATE POLICY "payments_select_members" ON payments FOR SELECT USING (is_member(group_id));
CREATE POLICY "payments_insert_members" ON payments FOR INSERT WITH CHECK (is_member(group_id));
CREATE POLICY "payments_delete_creator_owner_admin" ON payments FOR DELETE USING (
  from_user_id = auth.uid() OR is_admin_or_owner(group_id)
);

-- 9. messages
CREATE POLICY "messages_select_members" ON messages FOR SELECT USING (is_member(group_id));
CREATE POLICY "messages_insert_members" ON messages FOR INSERT WITH CHECK (is_member(group_id));
CREATE POLICY "messages_delete_own" ON messages FOR DELETE USING (sender_user_id = auth.uid());

-- 10. mentions
CREATE POLICY "mentions_select_members" ON mentions FOR SELECT USING (is_member(group_id));

-- 11. message_reactions
CREATE POLICY "message_reactions_select_members" ON message_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m WHERE m.id = message_reactions.message_id AND is_member(m.group_id)
  )
);
CREATE POLICY "message_reactions_all_members" ON message_reactions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM messages m WHERE m.id = message_reactions.message_id AND is_member(m.group_id)
  )
);

-- 12. standing_orders
CREATE POLICY "standing_orders_select_members" ON standing_orders FOR SELECT USING (is_member(group_id));
CREATE POLICY "standing_orders_write_members" ON standing_orders FOR INSERT WITH CHECK (is_member(group_id));
CREATE POLICY "standing_orders_update_members" ON standing_orders FOR UPDATE USING (is_member(group_id));
CREATE POLICY "standing_orders_delete_owner_admin" ON standing_orders FOR DELETE USING (is_admin_or_owner(group_id));

-- 13. notifications
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());

-- 14. group_invites
CREATE POLICY "group_invites_select_members" ON group_invites FOR SELECT USING (is_member(group_id));
CREATE POLICY "group_invites_select_by_token" ON group_invites FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND token = current_setting('request.token', true)
);
CREATE POLICY "group_invites_owner_admin" ON group_invites FOR ALL USING (is_admin_or_owner(group_id));

-- 15. rate_limits
CREATE POLICY "rate_limits_deny_all" ON rate_limits FOR ALL USING (false);

-- 16. ai_budget
CREATE POLICY "ai_budget_deny_all" ON ai_budget FOR ALL USING (false);


