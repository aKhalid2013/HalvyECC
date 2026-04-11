-- ============================================================================
-- Migration: 00002_copilot_review_fixes
-- Description: Addresses Copilot PR review findings on SPEC-002
-- Branch: feat/SPEC-002-database
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fix groups RLS
--    The original FOR ALL policy blocked group creation because
--    is_admin_or_owner() queries group_members, which doesn't exist yet
--    when the group row is being inserted.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "groups_write_owner_admin" ON groups;

CREATE POLICY "groups_insert_owner"       ON groups FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "groups_update_owner_admin" ON groups FOR UPDATE USING (is_admin_or_owner(id));
CREATE POLICY "groups_delete_owner_admin" ON groups FOR DELETE USING (is_admin_or_owner(id));

-- ----------------------------------------------------------------------------
-- 2. Add group_members bootstrap INSERT policy
--    Allows inserting the initial owner membership row when is_admin_or_owner()
--    would fail (no group_members rows exist yet at creation time).
-- ----------------------------------------------------------------------------
CREATE POLICY "group_members_insert_initial_owner" ON group_members FOR INSERT WITH CHECK (
  role = 'owner' AND EXISTS (
    SELECT 1 FROM groups WHERE groups.id = group_members.group_id AND groups.owner_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 3. Replace non-selective deleted_at partial indexes
--    Indexing deleted_at WHERE deleted_at IS NULL is useless — all indexed
--    rows share the same NULL key. Replace with composite partial indexes
--    that actually support active-row fetches by group.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_expenses_deleted_at;
CREATE INDEX idx_expenses_active_group_created
    ON expenses(group_id, created_at DESC)
    WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_payments_deleted_at;
CREATE INDEX idx_payments_active_group_created
    ON payments(group_id, created_at DESC)
    WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_messages_deleted_at;
CREATE INDEX idx_messages_active_group_created
    ON messages(group_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. Fix fn_payment_msg amount formatting
--    NEW.amount::text can produce '25' instead of '25.00'. Use to_char with
--    FM modifier to always emit exactly 2 decimal places.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_payment_msg()
RETURNS TRIGGER AS $$
DECLARE
  from_name TEXT;
  to_name   TEXT;
BEGIN
  IF NEW.from_user_id IS NOT NULL THEN
    SELECT display_name INTO from_name FROM users WHERE id = NEW.from_user_id;
  ELSE
    SELECT display_name INTO from_name FROM placeholders WHERE id = NEW.from_placeholder_id;
  END IF;

  IF NEW.to_user_id IS NOT NULL THEN
    SELECT display_name INTO to_name FROM users WHERE id = NEW.to_user_id;
  ELSE
    SELECT display_name INTO to_name FROM placeholders WHERE id = NEW.to_placeholder_id;
  END IF;

  INSERT INTO messages (group_id, message_type, body, payment_id, created_at)
  VALUES (
    NEW.group_id,
    'system_event',
    COALESCE(from_name, 'Someone') || ' paid ' || COALESCE(to_name, 'Someone')
      || ' · ' || fn_currency_symbol(NEW.currency) || to_char(NEW.amount, 'FM999999990.00'),
    NEW.id,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DOWN (rollback)
-- ============================================================================
-- DROP POLICY IF EXISTS "groups_insert_owner"       ON groups;
-- DROP POLICY IF EXISTS "groups_update_owner_admin" ON groups;
-- DROP POLICY IF EXISTS "groups_delete_owner_admin" ON groups;
-- CREATE POLICY "groups_write_owner_admin" ON groups FOR ALL USING (is_admin_or_owner(id));
--
-- DROP POLICY IF EXISTS "group_members_insert_initial_owner" ON group_members;
--
-- DROP INDEX IF EXISTS idx_expenses_active_group_created;
-- CREATE INDEX idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NULL;
--
-- DROP INDEX IF EXISTS idx_payments_active_group_created;
-- CREATE INDEX idx_payments_deleted_at ON payments(deleted_at) WHERE deleted_at IS NULL;
--
-- DROP INDEX IF EXISTS idx_messages_active_group_created;
-- CREATE INDEX idx_messages_deleted_at ON messages(deleted_at) WHERE deleted_at IS NULL;
--
-- Restore original fn_payment_msg with amount::text (manual — omitted here)
