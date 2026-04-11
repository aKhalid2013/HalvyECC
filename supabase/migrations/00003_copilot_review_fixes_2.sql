-- ============================================================================
-- Migration: 00003_copilot_review_fixes_2
-- Description: Addresses remaining Copilot PR review findings on SPEC-002
-- Branch: feat/SPEC-002-database
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. fn_owner_transfer role updates
--    Update both groups.owner_id AND group_members.role to preserve 
--    the owner privileges for the newly promoted user.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_owner_transfer()
RETURNS TRIGGER AS $$
DECLARE
  grp_id      UUID;
  new_owner   UUID;
BEGIN
  IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    FOR grp_id IN
      SELECT id FROM groups WHERE owner_id = OLD.id
    LOOP
      SELECT user_id INTO new_owner
      FROM group_members
      WHERE group_id = grp_id
        AND user_id <> OLD.id
        AND user_id IS NOT NULL
      ORDER BY joined_at ASC
      LIMIT 1;

      -- Only transfer if there is another live member to receive ownership.
      IF new_owner IS NOT NULL THEN
        -- Demote old owner to member
        UPDATE group_members SET role = 'member' WHERE group_id = grp_id AND user_id = OLD.id;
        
        -- Promote new owner
        UPDATE group_members SET role = 'owner' WHERE group_id = grp_id AND user_id = new_owner;
        
        -- Update group owner_id
        UPDATE groups SET owner_id = new_owner WHERE id = grp_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. group_members policy (Missing WITH CHECK)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "group_members_write_owner_admin" ON group_members;
CREATE POLICY "group_members_write_owner_admin" ON group_members 
  FOR ALL 
  USING (is_admin_or_owner(group_id)) 
  WITH CHECK (is_admin_or_owner(group_id));

-- ----------------------------------------------------------------------------
-- 3. expenses_update_members missing WITH CHECK
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "expenses_update_members" ON expenses;
CREATE POLICY "expenses_update_members" ON expenses 
  FOR UPDATE 
  USING (is_member(group_id)) 
  WITH CHECK (is_member(group_id));

-- ----------------------------------------------------------------------------
-- 4. line_items empty WITH CHECK
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "line_items_all_members" ON line_items;
CREATE POLICY "line_items_all_members" ON line_items 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM expenses e WHERE e.id = line_items.expense_id AND is_member(e.group_id)
    )
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e WHERE e.id = line_items.expense_id AND is_member(e.group_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 5. line_item_splits empty WITH CHECK
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "line_item_splits_all_members" ON line_item_splits;
CREATE POLICY "line_item_splits_all_members" ON line_item_splits 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM expenses e WHERE e.id = line_item_splits.expense_id AND is_member(e.group_id)
    )
  ) 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e WHERE e.id = line_item_splits.expense_id AND is_member(e.group_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Rate limits & AI Budget deny-all fixes (adding WITH CHECK)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rate_limits_deny_all" ON rate_limits;
CREATE POLICY "rate_limits_deny_all" ON rate_limits FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "ai_budget_deny_all" ON ai_budget;
CREATE POLICY "ai_budget_deny_all" ON ai_budget FOR ALL USING (false) WITH CHECK (false);
