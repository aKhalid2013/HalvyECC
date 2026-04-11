# SPEC-002 Implementation Tasks

## Overview
This plan implements the entire Halvy database foundation: a single Supabase migration file containing 7 enums, 16 tables, all constraints, 18+ indexes, 9 domain triggers, moddatetime triggers, and RLS policies for every table. It then generates TypeScript types from the schema, creates hand-crafted app-level models with camelCase interfaces, provides seed data for verification, documents the migration, and adds pgTAP SQL tests covering constraints, RLS, and triggers. The migration is split across 4 tasks by concern (schema, indexes, triggers, RLS) to keep each TDD session focused.

## Prerequisites
- [ ] Supabase CLI installed (`npm install -g supabase` or `npx supabase`)
- [ ] Docker Desktop installed and running (required for `supabase start`)
- [ ] `feat/SPEC-002-database` branch created from `feat/SPEC-001-expo-infrastructure`

## Approval Checklist
- [ ] All tasks are ordered so each can run in a standalone `/tdd` session
- [ ] Migration is divided by concern (schema, indexes, triggers, RLS)
- [ ] Type generation depends on migration being applied first
- [ ] Seed data and tests are separate tasks
- [ ] Task count is within 8–10

---

## Task List

### TASK-1: Supabase Init + Extensions + Enums + 16 Tables (DDL skeleton)
**Status:** ✅ done
**Estimated effort:** L
**Acceptance Criteria Covered:** AC-1 (partial), AC-2, AC-3, AC-5, AC-20 (partial)

#### Context
Read before starting:
- `docs/schema/README.md` (canonical table definitions for all 13 core tables)
- `docs/specs/phase-1/SPEC-002-database.md` Section 4 (satellite tables: `group_invites`, `rate_limits`, `ai_budget`)
- `docs/api/README.md` (for `group_invites` and `rate_limits` table shapes)
- `docs/ai-integration/README.md` Section 8.2 (for `ai_budget` table shape)

This task creates the Supabase project scaffold and the first section of the migration file: extensions, all 7 enums, and all 16 `CREATE TABLE` statements with column definitions and inline `REFERENCES` foreign keys. XOR constraints, partial unique index `one_owner_per_group`, and CHECK constraints are included inline in the CREATE TABLE statements. Explicit standalone indexes, triggers, and RLS policies are deferred to subsequent tasks.

The migration file will be built incrementally across TASK-1 through TASK-4. TASK-1 creates the file; TASK-2/3/4 extend it.

#### Files
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/00001_initial_schema.sql` (extensions + enums + 16 tables with inline constraints)

#### Steps
1. Run `supabase init` in the project root to create the `supabase/` directory and `config.toml`
2. Run `supabase start` to verify Docker-based local Supabase is running
3. Create `supabase/migrations/00001_initial_schema.sql`
4. Add `CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;` at the top
5. Add `CREATE EXTENSION IF NOT EXISTS pg_cron;` as a stub (comment noting execution logic is Phase 5)
6. Define all 7 enums: `group_type`, `member_role`, `expense_entry_method`, `message_type`, `notification_type`, `recurrence_unit`, `standing_order_split_mode`
7. Define all 16 tables in dependency order:
   `users` → `groups` → `group_members` → `placeholders` → `expenses` → `line_items` → `line_item_splits` → `payments` → `messages` → `mentions` → `message_reactions` → `standing_orders` → `notifications` → `group_invites` → `rate_limits` → `ai_budget`
8. Include all inline constraints:
   - XOR CHECKs on `group_members` (user_id vs placeholder_id)
   - XOR CHECKs on `expenses` (payer_user_id vs payer_placeholder_id)
   - XOR CHECKs on `line_item_splits` (user_id vs placeholder_id)
   - XOR CHECKs on `payments` (from_user/placeholder, to_user/placeholder — 2 XOR constraints)
   - `fixed_split_requires_rule` CHECK on `standing_orders`
   - UNIQUE constraints, NOT NULL, DEFAULT values per schema.md v5.0
9. Run `supabase db reset` to verify the migration applies cleanly

#### Done When
- [ ] `supabase/config.toml` exists
- [ ] `supabase/migrations/00001_initial_schema.sql` exists and contains all 7 enums and 16 CREATE TABLE statements
- [ ] All 5 XOR constraints are present (group_members ×1, expenses ×1, line_item_splits ×1, payments ×2)
- [ ] `fixed_split_requires_rule` CHECK constraint is present on `standing_orders`
- [ ] `supabase db reset` exits 0
- [ ] `supabase status` shows all services running

---

### TASK-2: Indexes + Partial Unique Index
**Status:** ✅ done
**Estimated effort:** S
**Acceptance Criteria Covered:** AC-4, AC-6

#### Context
Read before starting:
- `docs/schema/README.md` "Key Indexes" section (all 18 indexes listed)
- `docs/specs/phase-1/SPEC-002-database.md` AC-4 (partial unique index) and AC-6 (18 indexes)
- `supabase/migrations/00001_initial_schema.sql` (created in TASK-1)

This task appends all explicit indexes to the migration file. The partial unique index `one_owner_per_group` is created as `CREATE UNIQUE INDEX ... WHERE role = 'owner'` (not an inline CONSTRAINT, because PostgreSQL partial unique indexes require this syntax).

#### Files
- Modify: `supabase/migrations/00001_initial_schema.sql` (append indexes section)

#### Steps
1. Append a `-- ============ INDEXES ============` section to the migration file
2. Add all 18 indexes from schema.md v5.0 "Key Indexes" section
3. Add the partial unique index: `CREATE UNIQUE INDEX one_owner_per_group ON group_members(group_id) WHERE role = 'owner';`
4. Run `supabase db reset` to verify all indexes are created
5. Verify index count: query `SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'` and confirm ≥ 18 explicit indexes (plus primary key indexes)

#### Done When
- [ ] All 18 named indexes from schema.md exist in the migration
- [ ] `one_owner_per_group` partial unique index exists
- [ ] `supabase db reset` exits 0
- [ ] Query `pg_indexes` confirms expected count
- [ ] Manually inserting a second `owner` row for the same group (via SQL) fails with unique violation

---

### TASK-3: Triggers (9 Domain + moddatetime)
**Status:** ✅ done
**Estimated effort:** L
**Acceptance Criteria Covered:** AC-11, AC-12, AC-13, AC-14

#### Context
Read before starting:
- `docs/specs/phase-1/SPEC-002-database.md` Section 4 "Triggers Included in SPEC-002" (all 9 triggers)
- `docs/specs/phase-1/SPEC-002-database.md` Section 4 "moddatetime Triggers" (11 tables)
- `docs/schema/README.md` "Triggers & Automation" section
- `supabase/migrations/00001_initial_schema.sql` (current state after TASK-1 + TASK-2)

This task appends all trigger functions and trigger definitions. There are 9 domain triggers and 11 moddatetime triggers. Important notes:
- `trg_placeholder_claim_check` fires on INSERT to `public.users` (not `auth.users`)
- The standing order execution is a pg_cron stub — function body deferred to Phase 5
- The `auth.users → public.users` sync trigger is NOT created here (that is SPEC-003)
- Tables with `updated_at` that need moddatetime: `users`, `groups`, `group_members`, `placeholders`, `expenses`, `line_items`, `line_item_splits`, `payments`, `standing_orders`, `rate_limits`, `ai_budget` (11 tables)
- Tables WITHOUT `updated_at` (no moddatetime): `messages`, `mentions`, `message_reactions`, `notifications`, `group_invites`

#### Files
- Modify: `supabase/migrations/00001_initial_schema.sql` (append triggers section)

#### Steps
1. Append a `-- ============ TRIGGER FUNCTIONS ============` section
2. Create trigger functions for all 9 domain triggers:
   - `fn_balance_broadcast()` — uses `pg_notify` to broadcast to `balances:{group_id}` channel
   - `fn_expense_create_msg()` — inserts `system_event` message: "[creator] added [title]"
   - `fn_expense_edit_msg()` — inserts `system_event` message on UPDATE (only if substantive columns changed)
   - `fn_expense_delete_msg()` — inserts `system_event` message when `deleted_at` transitions NULL → non-NULL
   - `fn_payment_msg()` — inserts `system_event` message: "[from] paid [to] · $[amount]"
   - `fn_owner_transfer()` — reassigns `groups.owner_id` to earliest `joined_at` member when user is soft-deleted
   - `fn_placeholder_claim_check()` — matches new `public.users` row email/phone against unclaimed placeholders; creates `placeholder_claim_available` notification
   - `fn_mention_notification()` — inserts `mention` notification on mention INSERT
   - `fn_item_reassign_notification()` — inserts `item_reassigned` notification when `line_item_splits.user_id` changes
3. Create stub: `fn_standing_order_execute()` with comment noting execution logic is Phase 5
4. Append a `-- ============ TRIGGERS ============` section
5. Create all 9 domain triggers attached to their respective tables
6. Append a `-- ============ MODDATETIME TRIGGERS ============` section
7. Create moddatetime triggers for all 11 tables with `updated_at`
8. Run `supabase db reset` to verify all triggers compile

#### Done When
- [ ] 9 domain trigger functions and their triggers exist in the migration
- [ ] 11 moddatetime triggers exist in the migration
- [ ] `supabase db reset` exits 0
- [ ] `SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public'` confirms expected count

---

### TASK-4: RLS Policies (all 16 tables)
**Status:** ✅ done
**Estimated effort:** L
**Acceptance Criteria Covered:** AC-7, AC-8, AC-9, AC-10

#### Context
Read before starting:
- `docs/schema/README.md` "Row-Level Security Policies" summary table
- `docs/specs/phase-1/SPEC-002-database.md` Section 4 — RLS for `group_invites`, `rate_limits`, `ai_budget`
- `docs/specs/phase-1/SPEC-002-database.md` AC-7 through AC-10
- `supabase/migrations/00001_initial_schema.sql` (current state after TASK-1 through TASK-3)

This task appends `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for all 16 tables and creates all RLS policies matching the permission matrix in schema.md v5.0.

Key patterns:
- `users`: own row only (`auth.uid() = id`)
- Group-scoped tables: EXISTS subquery on `group_members` for membership check
- `notifications`: own rows only (`user_id = auth.uid()`), no user INSERT/UPDATE/DELETE
- `group_invites`: members SELECT; any authenticated user SELECT by token; owner/admin INSERT/DELETE
- `rate_limits`, `ai_budget`: `USING(false)` deny-all for all operations

#### Files
- Modify: `supabase/migrations/00001_initial_schema.sql` (append RLS section)

#### Steps
1. Append a `-- ============ ROW LEVEL SECURITY ============` section
2. Add `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;` for all 16 tables
3. Create RLS policies per table in this order:
   - `users`: SELECT/UPDATE own row only
   - `groups`: SELECT for members, INSERT/UPDATE/DELETE for owner/admin
   - `group_members`: SELECT for group members, INSERT/UPDATE/DELETE for owner/admin
   - `placeholders`: SELECT for members, INSERT for any member, UPDATE for owner/admin
   - `expenses`: SELECT for members, INSERT for any member, UPDATE for any member, DELETE for creator/admin/owner
   - `line_items`: SELECT for members, INSERT/UPDATE/DELETE for any member via expense edit
   - `line_item_splits`: SELECT for members, INSERT/UPDATE/DELETE for any member
   - `payments`: SELECT for members, INSERT for any member or owner/admin, DELETE for creator/admin/owner
   - `messages`: SELECT for members, INSERT for any member, DELETE own message only
   - `mentions`: SELECT for members, INSERT system-only (no user INSERT policy)
   - `message_reactions`: SELECT for members, INSERT/DELETE for any member
   - `standing_orders`: SELECT for members, INSERT/UPDATE for any member, DELETE for owner/admin
   - `notifications`: SELECT own rows only, no user INSERT/UPDATE/DELETE
   - `group_invites`: per SPEC-002 Section 4 (members SELECT, any-auth SELECT by token, owner/admin INSERT/DELETE)
   - `rate_limits`: deny-all (USING(false) / WITH CHECK(false))
   - `ai_budget`: deny-all (USING(false) / WITH CHECK(false))
4. Run `supabase db reset` to verify all policies compile

#### Done When
- [ ] All 16 tables have `ENABLE ROW LEVEL SECURITY`
- [ ] Each table has appropriate SELECT/INSERT/UPDATE/DELETE policies per schema.md permission matrix
- [ ] `rate_limits` and `ai_budget` have explicit deny-all policies for all 4 operations
- [ ] `group_invites` has: member SELECT + token-based SELECT + owner/admin INSERT/DELETE
- [ ] `supabase db reset` exits 0
- [ ] AC-1 fully satisfied: complete 16-table migration file exists and applies cleanly

---

### TASK-5: Seed Data
**Status:** ✅ done
**Estimated effort:** M
**Acceptance Criteria Covered:** AC-17, AC-18

#### Context
Read before starting:
- `docs/specs/phase-1/SPEC-002-database.md` AC-17 (exact seed data requirements)
- `docs/schema/README.md` (column names and types per table)
- `supabase/migrations/00001_initial_schema.sql` (must be complete — all 4 prior tasks done)

Seed inserts directly into `public.users` (bypassing `auth.users` — no Auth yet). Use hardcoded UUIDs for determinism. Seed runs as postgres superuser, so RLS is bypassed. Must respect all FK order, XOR constraints, and CHECK constraints.

#### Files
- Create: `supabase/seed.sql`

#### Steps
1. Create `supabase/seed.sql` with a header comment explaining it is for development/testing only
2. Insert 2 test users with hardcoded UUIDs (e.g., `'11111111-1111-1111-1111-111111111111'` and `'22222222-2222-2222-2222-222222222222'`)
3. Insert 1 group (type `dinner`, currency `USD`, owner = user 1)
4. Insert 2 `group_members` rows (user 1 as `owner`, user 2 as `member`)
5. Insert 3 expenses with line items:
   - Expense 1: manual, 2 line items, user 1 pays, user 2 assigned one item via `line_item_splits`
   - Expense 2: manual, 1 line item + 1 tax line item, user 2 pays, user 1 assigned
   - Expense 3: manual, 2 line items, both users assigned splits
6. Insert 1 payment (user 2 → user 1)
7. Run `supabase db reset` to verify seed applies without errors
8. Run SQL count queries to verify: 2 users, 1 group, 2 group_members, 3 expenses, 5+ line_items, 3+ line_item_splits, 1 payment

#### Done When
- [ ] `supabase/seed.sql` exists
- [ ] `supabase db reset` exits 0 (migration + seed with no errors)
- [ ] All XOR constraints respected — no constraint violations
- [ ] All FK references valid — no FK violations
- [ ] Row counts match expected values for all seeded tables

---

### TASK-6: TypeScript Type Generation (`database.ts`)
**Status:** ✅ done
**Estimated effort:** S
**Acceptance Criteria Covered:** AC-15

#### Context
Read before starting:
- `docs/specs/phase-1/SPEC-002-database.md` AC-15
- `tsconfig.json` (path aliases: `@/*` → `./src/*`)

The canonical file path is `src/types/database.ts` (per schema.md and SPEC-002). The `src/shared/types/` directory from SPEC-001 is a separate concern. Create `src/types/` if it does not exist (it may already exist from SPEC-001 scaffolding). Supabase must be running and migration must be applied before generating.

#### Files
- Create: `src/types/database.ts` (generated)

#### Steps
1. Ensure Supabase is running (`supabase start`) and migration + seed are applied (`supabase db reset`)
2. Create `src/types/` directory if it does not exist
3. Run: `npx supabase gen types typescript --local > src/types/database.ts`
4. Verify the generated file contains type definitions for all 16 public tables
5. Run `npx tsc --noEmit` to verify the generated types compile with the project's TypeScript config

#### Done When
- [ ] `src/types/database.ts` exists and was generated by `supabase gen types`
- [ ] File contains type definitions for all 16 public tables and all 7 enums
- [ ] `npx tsc --noEmit` passes

---

### TASK-7: App-Level Models (`models.ts`)
**Status:** ✅ done
**Estimated effort:** M
**Acceptance Criteria Covered:** AC-16

#### Context
Read before starting:
- `docs/specs/phase-1/SPEC-002-database.md` AC-16 (full list of required interfaces and union types)
- `docs/api/README.md` (camelCase type conventions used in API contracts — cross-reference for field names)
- `docs/schema/README.md` (column names per table)
- `src/types/database.ts` (generated in TASK-6, for reference — `models.ts` is hand-crafted, not derived)

This file provides idiomatic TypeScript types for the rest of the codebase. All property names are camelCase. Discriminated unions are used for all 7 enums. Interfaces map 1:1 with DB tables but follow TypeScript conventions.

#### Files
- Create: `src/types/models.ts`

#### Steps
1. Create `src/types/models.ts`
2. Define all 7 discriminated union types:
   - `MemberRole = 'owner' | 'admin' | 'member'`
   - `GroupType = 'dinner' | 'trip' | 'house'`
   - `ExpenseEntryMethod = 'manual' | 'ocr' | 'voice' | 'standing_order'`
   - `MessageType = 'user_text' | 'expense_card' | 'system_event' | 'expense_reply'`
   - `NotificationType` — all 10 values from schema.md
   - `RecurrenceUnit = 'day' | 'week' | 'month' | 'year'`
   - `StandingOrderSplitMode = 'fixed' | 'collaborative'`
3. Define camelCase interfaces for all 16 tables:
   `User`, `Group`, `GroupMember`, `Placeholder`, `Expense`, `LineItem`, `LineItemSplit`, `Payment`, `Message`, `Mention`, `MessageReaction`, `StandingOrder`, `Notification`, `GroupInvite`, `RateLimit`, `AiBudget`
4. Use `string` for UUID and ISO 8601 date fields
5. Use `number` for NUMERIC fields
6. Use `string | null` for nullable text/UUID fields
7. Export all types as named exports (no default exports)
8. Run `npx tsc --noEmit` to verify types compile

#### Done When
- [ ] `src/types/models.ts` exists with all 7 union types and 16 interfaces
- [ ] All property names are camelCase (no snake_case)
- [ ] All exports are named exports
- [ ] `npx tsc --noEmit` passes

---

### TASK-8: Migration Log + Documentation
**Status:** ✅ done
**Estimated effort:** S
**Acceptance Criteria Covered:** AC-19

#### Context
Read before starting:
- `docs/specs/phase-1/SPEC-002-database.md` AC-19
- `AGENTS.md` rule: every migration must include a DOWN rollback section
- `supabase/migrations/00001_initial_schema.sql` (completed migration to document)

#### Files
- Create: `supabase/MIGRATION_LOG.md`

#### Steps
1. Create `supabase/MIGRATION_LOG.md`
2. Add header: `# Supabase Migration Log`
3. Add entry for `00001_initial_schema.sql`:
   - **Date:** today (2026-04-11)
   - **Description:** "Initial schema — all 16 tables, 7 enums, 18+ indexes, 9 domain triggers, 11 moddatetime triggers, RLS policies for all tables. Based on schema.md v5.0."
   - **Tables created:** list all 16
   - **Enums created:** list all 7
4. Add DOWN rollback section with `DROP TABLE` statements in reverse FK-dependency order:
   - Drop: `ai_budget`, `rate_limits`, `group_invites`, `notifications`, `standing_orders`, `message_reactions`, `mentions`, `messages`, `payments`, `line_item_splits`, `line_items`, `expenses`, `placeholders`, `group_members`, `groups`, `users`
   - Drop enums in reverse order
   - Drop extensions: `moddatetime`, `pg_cron`
5. Verify the rollback order respects all FK constraints

#### Done When
- [ ] `supabase/MIGRATION_LOG.md` exists
- [ ] Contains entry for `00001_initial_schema.sql` with date and description
- [ ] Contains DOWN rollback section with all DROP TABLE statements in correct reverse order
- [ ] DROP order respects FK dependencies

---

### TASK-9: pgTAP SQL Tests
**Status:** pending
**Estimated effort:** L
**Acceptance Criteria Covered:** AC-3, AC-4, AC-5, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14

#### Context
Read before starting:
- `docs/specs/phase-1/SPEC-002-database.md` Section 11 "Testing Strategy"
- `docs/specs/phase-1/SPEC-002-database.md` AC-3 through AC-14
- `supabase/seed.sql` (seed data UUIDs for test setup)
- The completed migration (`supabase/migrations/00001_initial_schema.sql`)

pgTAP tests run via `supabase test db`. To test RLS, use `SET LOCAL ROLE` to switch to `authenticated` or `anon` role, and use `SET LOCAL request.jwt.claims` to simulate `auth.uid()`. Each test file wraps in `BEGIN; ... ROLLBACK;` for isolation.

Note: pgTAP may need to be enabled in `supabase/config.toml` if not already default. Check Supabase CLI docs for local pgTAP test setup.

#### Files
- Create: `supabase/tests/00001_constraints.test.sql`
- Create: `supabase/tests/00002_indexes.test.sql`
- Create: `supabase/tests/00003_rls.test.sql`
- Create: `supabase/tests/00004_triggers.test.sql`

#### Steps
1. Create `supabase/tests/` directory
2. Create `00001_constraints.test.sql`:
   - Test XOR on `group_members`: both NULL → fails; both set → fails; only user_id → passes
   - Test XOR on `expenses`: payer_user_id + payer_placeholder_id both set → fails
   - Test XOR on `line_item_splits`
   - Test XOR on `payments` (from_user vs from_placeholder; to_user vs to_placeholder)
   - Test `one_owner_per_group`: first owner → passes; second owner same group → unique violation
   - Test `fixed_split_requires_rule`: `split_mode='fixed'` + NULL `split_rule` → CHECK violation
3. Create `00002_indexes.test.sql`:
   - Verify specific named indexes exist in `pg_indexes`
   - Verify `one_owner_per_group` partial index exists
4. Create `00003_rls.test.sql`:
   - Set up test data (insert users, group, group_members — as postgres superuser)
   - Switch to `anon` role: SELECT on every table → 0 rows
   - Switch to `authenticated` as member: can SELECT group-scoped tables, gets rows
   - Switch to `authenticated` as non-member: gets 0 rows from group-scoped tables
   - `rate_limits` + `ai_budget`: `authenticated` role gets 0 rows from SELECT, permission denied on INSERT
   - `notifications`: user sees only their own rows
   - `users`: user sees only their own row
   - `group_invites` token validation: non-member with valid token can SELECT that invite
5. Create `00004_triggers.test.sql`:
   - Test moddatetime: INSERT row, then UPDATE row, verify `updated_at` > original value
   - Test expense create system message: INSERT expense, verify `system_event` message created in `messages`
   - Test expense soft-delete message: UPDATE `deleted_at` from NULL → non-NULL, verify system message created
   - Test payment system message: INSERT payment, verify `system_event` message created
   - Test mention notification (AC-13): INSERT mention, verify `mention` notification row created in `notifications`
   - Test item reassignment notification (AC-14): UPDATE `line_item_splits.user_id`, verify `item_reassigned` notification created
   - Verify domain trigger count via `SELECT count(*) FROM pg_trigger WHERE ... `
6. Run `supabase test db` to verify all tests pass

#### Done When
- [ ] 4 test files exist in `supabase/tests/`
- [ ] Constraint tests cover all 5 XOR constraints + partial unique index + `fixed_split_requires_rule`
- [ ] RLS tests cover anon, authenticated member, authenticated non-member, rate_limits/ai_budget deny
- [ ] Trigger tests cover moddatetime, system messages, mention notification, item reassignment notification
- [ ] `supabase test db` passes all tests

---

## Task Dependency Map

```
TASK-1 (DDL skeleton)
  ├── TASK-2 (indexes)        ← can run in any order after TASK-1
  ├── TASK-3 (triggers)       ← can run in any order after TASK-1
  └── TASK-4 (RLS)            ← can run in any order after TASK-1
        │
        └── TASK-5 (seed data)      ← depends on TASK-1 through TASK-4
              ├── TASK-6 (database.ts)   ← depends on TASK-5 (migration applied with seed)
              │     └── TASK-7 (models.ts)   ← depends on TASK-6 (reference generated types)
              ├── TASK-8 (migration log)  ← depends on TASK-1 through TASK-4
              └── TASK-9 (pgTAP tests)   ← depends on TASK-1 through TASK-5
```

TASK-2, TASK-3, and TASK-4 are independent of each other (all depend only on TASK-1) and can be done in any order.

---

## Post-Completion Verification

After all 9 tasks are marked done, run this full verification:

```bash
supabase start
supabase db reset          # applies migration + seed
supabase status            # all services running
supabase test db           # all pgTAP tests pass
npx tsc --noEmit           # TypeScript compiles (database.ts + models.ts)
```

### AC Coverage
| AC | Task | Verification Method |
|----|------|---------------------|
| AC-1 | TASK-1 | `supabase db reset` exits 0; 16 tables exist |
| AC-2 | TASK-1 | `supabase db reset` + enum existence query |
| AC-3 | TASK-1 + TASK-9 | Constraint violation SQL test |
| AC-4 | TASK-2 + TASK-9 | SQL test: second owner INSERT fails |
| AC-5 | TASK-1 + TASK-9 | SQL test: fixed + NULL split_rule fails |
| AC-6 | TASK-2 + TASK-9 | `pg_indexes` count query |
| AC-7 | TASK-4 + TASK-9 | SQL test as `anon` role → 0 rows |
| AC-8 | TASK-4 + TASK-9 | RLS matrix integration tests |
| AC-9 | TASK-4 + TASK-9 | SQL test `authenticated` → 0 rows on rate_limits/ai_budget |
| AC-10 | TASK-4 + TASK-9 | SQL test: non-member with token can SELECT invite |
| AC-11 | TASK-3 + TASK-9 | `pg_trigger`/`pg_proc` count query |
| AC-12 | TASK-3 + TASK-9 | SQL test: UPDATE row → `updated_at` advanced |
| AC-13 | TASK-3 + TASK-9 | SQL test: INSERT mention → notification created |
| AC-14 | TASK-3 + TASK-9 | SQL test: UPDATE split user_id → notification created |
| AC-15 | TASK-6 | `npx tsc --noEmit` |
| AC-16 | TASK-7 | `npx tsc --noEmit` |
| AC-17 | TASK-5 | `supabase db reset` + count queries |
| AC-18 | TASK-5 | `supabase db reset` exits 0 |
| AC-19 | TASK-8 | File existence + content check |
| AC-20 | TASK-1 | `supabase start` + `supabase db reset` + `supabase status` all exit 0 |
