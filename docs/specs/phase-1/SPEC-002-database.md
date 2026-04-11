---
id: SPEC-002
title: "Database — Supabase Project, Migrations, RLS, Types, Seed Data"
phase: 1
status: approved
priority: P0
complexity: L
created: 2026-04-08
updated: 2026-04-11
depends-on: [SPEC-001]
branch: feat/SPEC-002-database
feasibility: passed
---

# SPEC-002: Database — Supabase Project, Migrations, RLS, Types, Seed Data

## 1. Overview

**Problem:** No database exists yet. SPEC-003 (Auth), SPEC-004 (Design System Tokens), and every Phase 2+ spec depend on a running Supabase instance with the full schema, RLS policies, triggers, and generated TypeScript types. Without this foundation, no feature work can begin.

**Solution:** Create a Supabase development project. Apply a single migration file (`supabase/migrations/00001_initial_schema.sql`) containing all 16 tables, 7 enums, all indexes, XOR constraints, partial unique indexes, 9 database triggers (excluding the `auth.users → public.users` sync trigger, which belongs to SPEC-003), moddatetime triggers for `updated_at`, and RLS policies for every table. Generate TypeScript types via `supabase gen types typescript`. Hand-craft app-level `models.ts` with camelCase wrappers and discriminated unions. Provide seed data for verification.

**Fits the vision because:** The living balance model — the core of "chat app with financial intelligence" — is powered entirely by the database layer. Every expense, payment, message, and balance computation flows through this schema. Getting the foundation right here means every downstream feature inherits correct financial arithmetic, proper access control, and real-time capabilities from day one.

---

## 2. User Stories

- As a **developer**, I want a Supabase dev project with the complete Halvy schema applied, so that I can build Auth (SPEC-003) and all subsequent features against a real database.
- As a **developer**, I want generated TypeScript types that mirror the database schema, so that every query and mutation is type-safe from day one.
- As a **developer**, I want app-level `models.ts` types with camelCase naming and discriminated unions, so that the rest of the codebase works with idiomatic TypeScript — not raw snake_case database rows.
- As a **developer**, I want seed data (users, group, expenses with line items), so that I can verify the migration, RLS, triggers, and type generation without depending on Auth being configured.
- As a **developer**, I want RLS policies on every table, so that no feature accidentally exposes data outside a user's groups.

---

## 3. Acceptance Criteria

Each criterion MUST be binary (pass/fail) and testable by the spec-verifier.

### Migration & Schema

- [ ] **AC-1:** `supabase/migrations/00001_initial_schema.sql` exists and contains DDL for all 16 tables: `users`, `groups`, `group_members`, `placeholders`, `expenses`, `line_items`, `line_item_splits`, `payments`, `messages`, `mentions`, `message_reactions`, `standing_orders`, `notifications`, `group_invites`, `rate_limits`, `ai_budget`.
  - **Oracle:** Type oracle (SQL parse) + `supabase db reset` exits 0.

- [ ] **AC-2:** All 7 enums are created: `group_type`, `member_role`, `expense_entry_method`, `message_type`, `notification_type`, `recurrence_unit`, `standing_order_split_mode`.
  - **Oracle:** SQL parse of migration file + `supabase db reset`.

- [ ] **AC-3:** XOR constraints exist on `group_members` (user_id vs placeholder_id), `expenses` (payer_user_id vs payer_placeholder_id), `line_item_splits` (user_id vs placeholder_id), and `payments` (from_user_id vs from_placeholder_id, to_user_id vs to_placeholder_id).
  - **Oracle:** `supabase db reset` + seed data insert test — inserting a row violating XOR returns a constraint error.

- [ ] **AC-4:** A partial unique index `one_owner_per_group` exists on `group_members(group_id) WHERE role = 'owner'`. Attempting to INSERT a second `owner` row for the same group fails with a unique violation.
  - **Oracle:** `supabase db reset` + SQL test inserting two owner rows for the same group.

- [ ] **AC-5:** The `standing_orders` table has `CONSTRAINT fixed_split_requires_rule CHECK (split_mode = 'collaborative' OR split_rule IS NOT NULL)`. Inserting a `fixed` split_mode row with `split_rule = NULL` fails.
  - **Oracle:** `supabase db reset` + SQL test.

- [ ] **AC-6:** All indexes from schema.md v5.0 are created (18 indexes total, including partial indexes on `deleted_at`, placeholder claiming indexes, standing order `next_run_at` index, and notification index).
  - **Oracle:** Query `pg_indexes` after migration — count matches expected.

### RLS Policies

- [ ] **AC-7:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is present for all 16 tables. Querying any table as `anon` role returns zero rows.
  - **Oracle:** `supabase db reset` + SQL test as `anon` role.

- [ ] **AC-8:** RLS policies for the 13 canonical tables match the permission matrix in schema.md v5.0. Specifically: `users` → own row only (read + write); `groups` → members read, owner/admin write; `expenses` → members read, any member create/edit, creator/admin/owner delete; `notifications` → own rows read, system-only write; and so on for all tables.
  - **Oracle:** Integration test suite (see Section 11) that attempts permitted and forbidden operations per role per table.

- [ ] **AC-9:** `rate_limits` and `ai_budget` have `USING (false)` for all user-facing operations (SELECT, INSERT, UPDATE, DELETE). Only `service_role` can read/write these tables.
  - **Oracle:** SQL test as `authenticated` role — all operations on `rate_limits` and `ai_budget` return zero rows or permission denied.

- [ ] **AC-10:** `group_invites` RLS allows: (a) SELECT by group members (`created_by_user_id` is member of the group) OR by any authenticated user filtering by `token` (for `validateInvite`); (b) INSERT/DELETE by group owner or admin only.
  - **Oracle:** SQL test — non-member with a valid token can SELECT that specific invite row; non-member without token gets zero rows.

### Triggers

- [ ] **AC-11:** 8 domain triggers exist in the migration (all triggers from schema.md except `auth.users → public.users`, which is SPEC-003). Specifically: (1) balance recalculation broadcast, (2) system message on expense create, (3) system message on expense edit, (4) system message on expense delete, (5) system message on payment, (6) owner transfer on user deletion, (7) placeholder claim check on user insert into `public.users`, (8) standing order execution (pg_cron stub — the cron schedule itself is set up when the Supabase project is created, but the function body is in the migration).
  - **Oracle:** Query `pg_trigger` and `pg_proc` — count and names match expected.

- [ ] **AC-12:** `moddatetime` triggers exist on all tables that have an `updated_at` column. Updating a row in any such table automatically sets `updated_at` to `now()`.
  - **Oracle:** SQL test — insert a row, wait 1 second, update it, verify `updated_at > created_at`.

- [ ] **AC-13:** The mention notification trigger is present: INSERT on `mentions` → INSERT a `mention` notification row for the mentioned user.
  - **Oracle:** SQL test — insert a mention row, verify a notification row was created.

- [ ] **AC-14:** The item reassignment notification trigger is present: UPDATE on `line_item_splits` where `user_id` changes → INSERT an `item_reassigned` notification for the affected user.
  - **Oracle:** SQL test — update a split's `user_id`, verify notification created.

### Type Generation

- [ ] **AC-15:** `src/types/database.ts` is generated by running `supabase gen types typescript --local > src/types/database.ts` and contains type definitions for all 16 tables. `npx tsc --noEmit` passes with this file in the project.
  - **Oracle:** Type oracle — `npx tsc --noEmit`.

- [ ] **AC-16:** `src/types/models.ts` exists with hand-crafted app-level types: camelCase interfaces for `User`, `Group`, `GroupMember`, `Placeholder`, `Expense`, `LineItem`, `LineItemSplit`, `Payment`, `Message`, `Mention`, `MessageReaction`, `StandingOrder`, `Notification`, `GroupInvite`. Discriminated union types exist for: `MemberRole` (`'owner' | 'admin' | 'member'`), `GroupType` (`'dinner' | 'trip' | 'house'`), `ExpenseEntryMethod` (`'manual' | 'ocr' | 'voice' | 'standing_order'`), `MessageType` (`'user_text' | 'expense_card' | 'system_event' | 'expense_reply'`), `NotificationType` (all 10 values), `RecurrenceUnit` (`'day' | 'week' | 'month' | 'year'`), `StandingOrderSplitMode` (`'fixed' | 'collaborative'`). `npx tsc --noEmit` passes.
  - **Oracle:** Type oracle — `npx tsc --noEmit`.

### Seed Data

- [ ] **AC-17:** `supabase/seed.sql` inserts: 2 test users (with hardcoded UUIDs, directly into `public.users` — not `auth.users`), 1 group (type `dinner`, currency `USD`), 1 `group_members` row per user (one `owner`, one `member`), 3 expenses with line items and at least 1 `line_item_split` per expense, and 1 payment. After `supabase db reset` (which runs seed), querying each table returns the expected row count.
  - **Oracle:** `supabase db reset` exits 0 + SQL count queries.

- [ ] **AC-18:** Seed data respects all XOR constraints, CHECK constraints, and foreign key references. `supabase db reset` completes without constraint violation errors.
  - **Oracle:** `supabase db reset` exits 0.

### Documentation

- [ ] **AC-19:** `supabase/MIGRATION_LOG.md` exists with an entry for `00001_initial_schema.sql` documenting: date, description ("Initial schema — all 16 tables, enums, indexes, triggers, RLS from schema.md v5.0"), and a DOWN rollback section with `DROP TABLE` statements in reverse dependency order.
  - **Oracle:** File existence + content check.

### Supabase Project

- [ ] **AC-20:** A Supabase development project exists (local via `supabase init` + `supabase start`, or remote dev instance). `supabase db reset` applies the migration and seed data without errors. `supabase status` shows all services running.
  - **Oracle:** Runtime oracle — `supabase start` + `supabase db reset` + `supabase status` all exit 0.

---

## 4. Data Model

### New Tables

All 16 tables are created in `supabase/migrations/00001_initial_schema.sql`. The full SQL is defined in schema.md v5.0 (canonical) plus the 3 satellite tables below. This section documents only the satellite tables whose SQL is not in schema.md.

#### `group_invites` (from api-contracts.md)

```sql
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

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

-- Members of the group can list invites
CREATE POLICY "group_invites_select_members" ON group_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = auth.uid()
    )
  );

-- Any authenticated user can SELECT a specific invite by token (for validateInvite)
CREATE POLICY "group_invites_select_by_token" ON group_invites
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND token = current_setting('request.token', true)
  );
-- Note: The implementing agent may use an RPC function for token validation instead of
-- this policy. The key requirement is: non-members can validate a token they possess.

-- Owner or admin can create and revoke invites
CREATE POLICY "group_invites_insert" ON group_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "group_invites_delete" ON group_invites
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_invites.group_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );
```

#### `rate_limits` (from api-contracts.md)

```sql
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

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No user access. All operations via service_role in Edge Functions only.
-- Explicit deny-all policies:
CREATE POLICY "rate_limits_deny_select" ON rate_limits FOR SELECT USING (false);
CREATE POLICY "rate_limits_deny_insert" ON rate_limits FOR INSERT WITH CHECK (false);
CREATE POLICY "rate_limits_deny_update" ON rate_limits FOR UPDATE USING (false);
CREATE POLICY "rate_limits_deny_delete" ON rate_limits FOR DELETE USING (false);
```

#### `ai_budget` (from ai-integration.md)

```sql
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

ALTER TABLE ai_budget ENABLE ROW LEVEL SECURITY;

-- No user access. All operations via service_role in Edge Functions only.
CREATE POLICY "ai_budget_deny_select" ON ai_budget FOR SELECT USING (false);
CREATE POLICY "ai_budget_deny_insert" ON ai_budget FOR INSERT WITH CHECK (false);
CREATE POLICY "ai_budget_deny_update" ON ai_budget FOR UPDATE USING (false);
CREATE POLICY "ai_budget_deny_delete" ON ai_budget FOR DELETE USING (false);
```

### Modified Tables

None. This is the initial schema — no prior tables exist.

### Enums

All 7 enums created in the migration:

| Enum | Values |
|------|--------|
| `group_type` | `dinner`, `trip`, `house` |
| `member_role` | `owner`, `admin`, `member` |
| `expense_entry_method` | `manual`, `ocr`, `voice`, `standing_order` |
| `message_type` | `user_text`, `expense_card`, `system_event`, `expense_reply` |
| `notification_type` | `expense_added`, `expense_edited`, `expense_deleted`, `payment_recorded`, `mention`, `item_reassigned`, `standing_order_fired`, `standing_order_failed`, `placeholder_claim_available`, `group_invite` |
| `recurrence_unit` | `day`, `week`, `month`, `year` |
| `standing_order_split_mode` | `fixed`, `collaborative` |

### Triggers Included in SPEC-002

| # | Trigger | On | Action | Notes |
|---|---------|-----|--------|-------|
| 1 | `trg_balance_broadcast` | INSERT/UPDATE/DELETE on `expenses`, `payments` | Fires Realtime broadcast to `balances:{groupId}` channel | Clients receive live balance updates |
| 2 | `trg_expense_create_msg` | INSERT on `expenses` | Insert `system_event` message: "[creator] added [title]" | Uses `creator_user_id` from the new row |
| 3 | `trg_expense_edit_msg` | UPDATE on `expenses` | Insert `system_event` message: "[editor] edited [title]" | Fires only if substantive columns changed |
| 4 | `trg_expense_delete_msg` | UPDATE `deleted_at` on `expenses` (from NULL to non-NULL) | Insert `system_event` message: "[actor] deleted [title]" | Soft delete detection |
| 5 | `trg_payment_msg` | INSERT on `payments` | Insert `system_event` message: "[from] paid [to] · $[amount]" | |
| 6 | `trg_owner_transfer` | UPDATE `deleted_at` on `users` (from NULL to non-NULL) | Reassign `groups.owner_id` to earliest `joined_at` member | Per schema.md owner departure rule |
| 7 | `trg_placeholder_claim_check` | INSERT on `public.users` | Match new user email/phone against unclaimed placeholders; if found, insert `placeholder_claim_available` notification | Works for seed data inserts too |
| 8 | `trg_mention_notification` | INSERT on `mentions` | Insert `mention` notification for `mentioned_user_id` | |
| 9 | `trg_item_reassign_notification` | UPDATE on `line_item_splits` WHERE `user_id` changes | Insert `item_reassigned` notification for the old `user_id` | Batching (5-min collapse) is application-layer; trigger creates the base row |

**NOT included (SPEC-003):** `auth.users → public.users` sync trigger.

**NOT included (Phase 2+):** Standing order execution cron job body — the `pg_cron` extension and scheduled function are created as stubs in the migration, but the actual execution logic (insert expenses + line items + advance `next_run_at`) is implemented in Phase 5 when standing orders are built.

### moddatetime Triggers

The PostgreSQL `moddatetime` extension is enabled in the migration. A `moddatetime` trigger is created for every table with an `updated_at` column:

`users`, `groups`, `group_members`, `placeholders`, `expenses`, `line_items`, `line_item_splits`, `payments`, `standing_orders`, `rate_limits`, `ai_budget`.

Tables without `updated_at` (and therefore no moddatetime trigger): `messages` (has `deleted_at` only), `mentions`, `message_reactions`, `notifications`, `group_invites`.

---

## 5. API Contracts

None. This spec creates the database layer only. No API endpoints, Edge Functions, or client-side API modules are created. The Supabase client singleton (`src/api/client.ts`) is deferred to SPEC-003.

---

## 6. UI/UX Specifications

None. This spec is entirely backend/database infrastructure. No screens or UI components are created.

---

## 7. Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | XOR violation: INSERT into `expenses` with both `payer_user_id` and `payer_placeholder_id` set | PostgreSQL rejects with CHECK constraint violation |
| 2 | XOR violation: INSERT into `expenses` with both payer columns NULL | PostgreSQL rejects with CHECK constraint violation |
| 3 | Two `owner` rows for the same group | Partial unique index `one_owner_per_group` rejects the second INSERT |
| 4 | `standing_orders` row with `split_mode = 'fixed'` and `split_rule = NULL` | CHECK constraint `fixed_split_requires_rule` rejects |
| 5 | Seed data references a user that doesn't exist | Foreign key constraint rejects — seed.sql must insert users first |
| 6 | Migration applied twice (`supabase db reset` twice) | Idempotent — `db reset` drops and recreates; no "already exists" errors |
| 7 | `updated_at` not explicitly set on UPDATE | `moddatetime` trigger automatically sets it to `now()` |
| 8 | Querying any table as `anon` role | RLS returns zero rows for all tables (no anon access in Halvy) |
| 9 | Authenticated user queries `rate_limits` or `ai_budget` | RLS `USING (false)` returns zero rows — these are service_role-only |
| 10 | Inserting a mention → notification trigger fires | A `mention` notification row is automatically created for the mentioned user |
| 11 | Soft-deleting a user who owns a group | `trg_owner_transfer` reassigns `owner_id` to the member with the earliest `joined_at` |

---

## 8. Error Handling

| Error | User-Facing Message | Technical Detail |
|-------|---------------------|------------------|
| Migration fails on `supabase db reset` | N/A (developer-only) | Fix SQL syntax in `00001_initial_schema.sql` and re-run |
| `supabase gen types` fails | N/A (developer-only) | Ensure Supabase is running (`supabase start`) and migration is applied |
| Constraint violation in seed data | N/A (developer-only) | Fix `seed.sql` to respect FK order and XOR constraints |
| `moddatetime` extension not available | N/A (developer-only) | Ensure `CREATE EXTENSION IF NOT EXISTS moddatetime;` is first line of migration |

---

## 9. Dependencies

- **Requires:** SPEC-001 (Expo infrastructure must exist — the generated `database.ts` and hand-crafted `models.ts` live in `src/types/` which is created by SPEC-001)
- **Blocks:** SPEC-003 (Auth — needs database to configure auth providers and create the `auth.users → public.users` trigger)
- **Blocks:** SPEC-004 (Design System Tokens — no direct DB dependency, but Phase 1 sequence is locked: 001 → 002 → 003 → 004)
- **Blocks:** All Phase 2+ specs (every feature reads/writes to this schema)

---

## 10. Complexity Estimate

- Frontend: **N/A** (no frontend work)
- Backend: **L** (16 tables, 7 enums, 18+ indexes, 9 domain triggers + moddatetime triggers, RLS for 16 tables, seed data)
- Testing: **M** (SQL-level tests for constraints, RLS, triggers; type compilation check)
- Total: **L**

---

## 11. Testing Strategy

### Unit Tests (SQL-level, run via `supabase test db`)

- **Constraint tests:** For each XOR constraint and CHECK constraint, attempt a valid insert (passes) and an invalid insert (fails with expected error).
- **Partial unique index test:** Insert one `owner` row → success. Insert a second `owner` for the same group → unique violation.
- **`fixed_split_requires_rule` test:** Insert `split_mode = 'fixed'` with `split_rule = NULL` → CHECK violation.

### Integration Tests (RLS, run via `supabase test db` with role switching)

- **Per-table RLS matrix:** For each of the 16 tables, test:
  - `anon` role: all operations return zero rows or permission denied.
  - `authenticated` role as a group member: permitted operations succeed, forbidden operations fail.
  - `authenticated` role as a non-member: all group-scoped operations return zero rows.
  - `service_role`: full access to `rate_limits` and `ai_budget`.
- **`group_invites` token validation:** Non-member with valid token can SELECT the invite row; without token, gets zero rows.

### Trigger Tests (run via `supabase test db`)

- **moddatetime:** Insert row, update row, verify `updated_at` advanced.
- **System message triggers:** Insert an expense, verify a `system_event` message row was created. Update the expense, verify another message. Soft-delete, verify delete message.
- **Payment message trigger:** Insert a payment, verify system message.
- **Owner transfer:** Soft-delete a user who is a group owner, verify `groups.owner_id` changed to the next-earliest member.
- **Mention notification:** Insert a mention, verify notification row created.
- **Item reassignment notification:** Update `line_item_splits.user_id`, verify notification row created for the old user.

### Compilation Tests

- `npx tsc --noEmit` passes with `database.ts` and `models.ts` in the project.

### No E2E Tests

This spec has no UI. E2E testing begins in Phase 2.

---

## 12. Feasibility Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Schema Compatibility | ✅ PASS | All 16 tables match canonical docs. No conflicts with existing schema (initial migration). 7 enums, 18+ indexes, all XOR/CHECK constraints verified against schema.md v5.0. |
| API Compatibility | ✅ PASS | No API endpoints created. Table/column names align with api-contracts.md types. Note: api-contracts.md `User.reliabilityScore` is stale (removed in schema v3.0) — not a SPEC-002 issue. |
| Dependency Verification | ✅ PASS | No npm packages added. Supabase CLI is a dev tool. `moddatetime` and `pg_cron` extensions ship with Supabase. No external dependencies. |
| Phase Alignment | ✅ PASS | All deliverables match Phase 1 → Database checklist in phasing-strategy.md. Dependency chain SPEC-001 → 002 → 003 → 004 matches Phase 1 sequence. |
| Oracle Coverage | ✅ PASS | 20/20 ACs have automated oracles (runtime or type-level). Zero manual/visual confirmation gaps. Bundle oracle correctly excluded — no client config files modified. |

**Verdict:** FEASIBLE
**Blockers:** None

---

## 13. Open Questions

All resolved during brainstorming. No open questions remain.

| # | Question | Resolution |
|---|----------|------------|
| 1 | Migration file structure? | Single file: `00001_initial_schema.sql` |
| 2 | `rate_limits` table schema? | Derived from api-contracts.md — see Section 4 |
| 3 | `group_invites` table schema? | Derived from api-contracts.md — see Section 4 |
| 4 | Seed data approach? | Insert directly into `public.users`, bypass `auth.users` |
| 5 | `models.ts` in which spec? | SPEC-002 — data-layer concern |
| 6 | Schema version reference? | v5.0 (canonical, not the v3.0 mentioned in phasing doc) |
| 7 | `one_owner_per_group` syntax? | Partial unique index, not inline CONSTRAINT |
| 8 | Which triggers in SPEC-002? | All 9 domain triggers except `auth.users → public.users` (SPEC-003) |
| 9 | `rate_limits` / `ai_budget` RLS? | `USING (false)` — service_role only |
| 10 | `group_invites` RLS? | Members can list; any authenticated user can validate by token; owner/admin can create/revoke |
| 11 | `updated_at` auto-update? | moddatetime extension + triggers on all tables with `updated_at` |

---

## Appendix A: Oracle Coverage Matrix

Every AC must map to at least one automated oracle. No AC relies solely on manual/visual confirmation.

| AC | Oracle Layer | Method |
|----|-------------|--------|
| AC-1 | Runtime | `supabase db reset` exits 0 |
| AC-2 | Runtime | `supabase db reset` + enum existence query |
| AC-3 | Runtime | `supabase db reset` + constraint violation SQL test |
| AC-4 | Runtime | SQL test inserting duplicate owner |
| AC-5 | Runtime | SQL test inserting invalid standing order |
| AC-6 | Runtime | `pg_indexes` count query |
| AC-7 | Runtime | SQL test as `anon` role |
| AC-8 | Test | Integration test suite — RLS matrix |
| AC-9 | Runtime | SQL test as `authenticated` role |
| AC-10 | Runtime | SQL test — token-based SELECT |
| AC-11 | Runtime | `pg_trigger` / `pg_proc` count query |
| AC-12 | Runtime | SQL test — update row, check `updated_at` |
| AC-13 | Runtime | SQL test — insert mention, check notification |
| AC-14 | Runtime | SQL test — update split, check notification |
| AC-15 | Type | `npx tsc --noEmit` |
| AC-16 | Type | `npx tsc --noEmit` |
| AC-17 | Runtime | `supabase db reset` + count queries |
| AC-18 | Runtime | `supabase db reset` exits 0 |
| AC-19 | Runtime | File existence + grep for required content |
| AC-20 | Runtime | `supabase start` + `supabase db reset` + `supabase status` |

**Gap analysis:** Zero ACs rely on manual/visual confirmation. All are automated via runtime or type oracles. Bundle oracle (Layer 3) is not required — this spec does not modify `package.json` deps, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, or `app.config.ts`.
