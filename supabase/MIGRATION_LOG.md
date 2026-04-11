# Supabase Migration Log

## `00001_initial_schema.sql`

- **Date:** 2026-04-11
- **Description:** Initial schema — all 16 tables, 7 enums, 18+ indexes, 9 domain triggers, 11 moddatetime triggers, RLS policies for all tables. Based on schema.md v5.0.

### Enums Created
1. `group_type`
2. `member_role`
3. `expense_entry_method`
4. `message_type`
5. `recurrence_unit`
6. `standing_order_split_mode`
7. `notification_type`

### Tables Created
1. `users`
2. `groups`
3. `group_members`
4. `placeholders`
5. `expenses`
6. `line_items`
7. `line_item_splits`
8. `payments`
9. `messages`
10. `mentions`
11. `message_reactions`
12. `standing_orders`
13. `notifications`
14. `group_invites`
15. `rate_limits`
16. `ai_budget`

---

## `00002_copilot_review_fixes.sql`

- **Date:** 2026-04-11
- **Description:** Incremental fixes from Copilot PR review on SPEC-002. Addresses RLS bootstrap gaps, non-selective partial indexes, and payment message formatting.

### Changes
- **groups RLS**: split `FOR ALL` into separate `INSERT` (owner_id check), `UPDATE`, and `DELETE` policies so new group creation isn't blocked by `is_admin_or_owner()` querying an empty `group_members` table
- **group_members RLS**: added `group_members_insert_initial_owner` bootstrap INSERT policy for the first owner row
- **Indexes**: replaced `idx_expenses_deleted_at`, `idx_payments_deleted_at`, `idx_messages_deleted_at` (all non-selective) with composite `(group_id, created_at DESC) WHERE deleted_at IS NULL` partial indexes
- **fn_payment_msg**: `NEW.amount::text` → `to_char(NEW.amount, 'FM999999990.00')` for consistent 2-decimal formatting

---

### DOWN Rollback (for revert)

To revert `00001_initial_schema.sql`, execute the following commands in order. These drops are in reverse foreign-key dependency order.

```sql
BEGIN;

-- 1. Drop Tables (Reverse FK Order)
DROP TABLE IF EXISTS public.ai_budget CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.group_invites CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.standing_orders CASCADE;
DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.mentions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.line_item_splits CASCADE;
DROP TABLE IF EXISTS public.line_items CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.placeholders CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. Drop Enums (Reverse Order)
DROP TYPE IF EXISTS public.notification_type CASCADE;
DROP TYPE IF EXISTS public.standing_order_split_mode CASCADE;
DROP TYPE IF EXISTS public.recurrence_unit CASCADE;
DROP TYPE IF EXISTS public.message_type CASCADE;
DROP TYPE IF EXISTS public.expense_entry_method CASCADE;
DROP TYPE IF EXISTS public.member_role CASCADE;
DROP TYPE IF EXISTS public.group_type CASCADE;

-- 3. Drop Extensions
DROP EXTENSION IF EXISTS moddatetime CASCADE;
DROP EXTENSION IF EXISTS pg_cron CASCADE;

COMMIT;
```

---

## `00003_copilot_review_fixes_2.sql`

- **Date:** 2026-04-11
- **Description:** Addresses remaining Copilot PR review findings on SPEC-002 policies (missing `WITH CHECK` clauses) and `fn_owner_transfer` logic.

### Changes
- **fn_owner_transfer**: updated to demote the old owner and promote the new one in `group_members` simultaneously with the `groups.owner_id` update.
- **RLS Policies**: added `WITH CHECK` clauses to `group_members`, `expenses`, `line_items`, and `line_item_splits` policies to prevent bypasses during INSERT/UPDATE.
- **Deny-all Policies**: added `WITH CHECK (false)` to `rate_limits` and `ai_budget`.

---

## `00004_auth_sync_trigger.sql`

- **Date:** 2026-04-11
- **Description:** Auth sync trigger for SPEC-003. Creates `fn_auth_sync_user()` (SECURITY DEFINER) and `trg_auth_sync_user` (AFTER INSERT ON auth.users FOR EACH ROW). Syncs new Supabase Auth sign-ups into `public.users` with metadata extraction. Idempotent multi-provider merge.

### DOWN Rollback

```sql
DROP TRIGGER IF EXISTS trg_auth_sync_user ON auth.users;
DROP FUNCTION IF EXISTS public.fn_auth_sync_user();
```
