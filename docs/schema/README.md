# schema.md

**Project:** Halvy — Next-Gen Social Expense Splitting Ecosystem
**Version:** 5.0
**Database:** Supabase (PostgreSQL)

> **v2.0 changes:** Replaced lock/settle/flag model with a unified living ledger. Removed `expense_status`, `settled_at`, `flag_expires_at`. Removed `expense_splits.is_settled`. Removed `settlements` table. Added `payments` table. Added `mentions`. Item assignment is collaborative.

> **v3.0 changes:** Removed `reliability_score` from `users`. Removed `group_reliability_score` from `group_members`. Removed reliability score trigger. Reliability scoring deferred to post-v1.

> **v4.0 changes:** Added `phone`, `email`, `created_by_user_id` to `placeholders`. Added claiming indexes and placeholder claim check trigger.

> **v5.0 changes:** Redesigned `standing_orders` table — replaced `recurrence` enum with `recurrence_every` (integer) + `recurrence_unit` (enum) for fully custom intervals. Added `split_mode` enum field to distinguish fixed vs. collaborative splits. Added `payer_user_id` field. Updated RLS row for standing_orders. Updated triggers table. Updated assumptions table.

---

## Assumptions & Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Deletes | Soft delete only (`deleted_at`) | Preserves audit trail; balance reversal is computed, not destructed |
| Chat messages | Stored in Supabase | Unified timeline — messages and expenses share one source of truth |
| Balance model | Computed live from all events (expenses + payments) | No persisted settled state; truth is always the net of all ledger entries |
| Settlements | Computed on-demand, never persisted | Snapshot of minimum transactions given current balances; recalculates live |
| Payments | Stored as `payments` rows — immutable ledger entries | Payments are facts; they affect balances permanently regardless of future expense edits |
| Expense editing | Any group member can edit at any time | Collaborative model; balances recalculate automatically on save |
| Expense deletion | Creator + group admin/owner only | Soft delete; balance contribution reversed automatically |
| Item assignment | Any group member can assign/claim any item at any time | Core collaborative feature; drives proportional share calculation |
| Roles | One role per group membership | A user can be admin in one group and member in another |
| Admin model | One owner + promotable admins | Owner is a special role; multiple admins can exist below them |
| Owner departure | Transfer to oldest member | Measured by `group_members.joined_at` ascending |
| Placeholder contact info | Optional phone or email on placeholder | Used for auto-match when the person later signs up; not required |
| Placeholder claiming | Partial — user confirms per group | User picks which placeholder groups to merge; not all-or-nothing |
| Placeholder ownership | Created by any member; edited by owner/admin only | Low barrier to create; restricted edits to prevent abuse |
| Standing order recurrence | Custom interval: `recurrence_every` + `recurrence_unit` | Supports any cadence (every 2 weeks, every 3 months, etc.) |
| Standing order split mode | Chosen at creation — fixed or collaborative | Fixed splits require no action each cycle; collaborative mirrors manual expense flow |
| Standing order creation | Any group member | Low barrier; same as expense creation |
| Standing order deletion | Owner/admin only | Permanent action; warrants elevated permission |
| Standing order pause | Any group member | Reversible; any member should be able to stop a recurring charge |
| Standing order failure | Retry 3 times, then auto-pause + notify admins | Prevents silent failures; keeps admins informed |
| Currency | Single currency per group, set at creation | Multi-currency deferred to post-v1 |
| Mentions | Stored as `mentions` rows referencing messages | Drives targeted notifications; parsed from message body at send time |

---

## Entity Relationship Overview

```
users
 ├── group_members ──────────────── groups
 │    └── (role)                     ├── group_type (enum)
 │                                   └── currency
 ├── expenses (as payer) ─────────── groups
 │    └── line_items
 │         └── line_item_splits ── users / placeholders
 │
 ├── payments ────────────────────── groups
 │
 ├── messages ───────────────────── groups
 │    ├── message_reactions
 │    └── mentions ──────────────── users
 │
 ├── standing_orders ─────────────── groups
 ├── placeholders ────────────────── groups
 └── notifications ───────────────── users
```

---

## Tables

---

### `users`

```sql
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT UNIQUE NOT NULL,
  display_name        TEXT NOT NULL,
  avatar_url          TEXT,
  auth_provider       TEXT NOT NULL, -- 'google' | 'apple' | 'magic_link'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
```

---

### `groups`

```sql
CREATE TYPE group_type AS ENUM ('dinner', 'trip', 'house');

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
```

> **Owner transfer trigger:** When `owner_id` is set to a deleted user, a trigger automatically reassigns it to the `group_members` row with the earliest `joined_at`.

---

### `group_members`

```sql
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE group_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  placeholder_id      UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  role                member_role NOT NULL DEFAULT 'member',
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT member_xor_placeholder CHECK (
    (user_id IS NOT NULL AND placeholder_id IS NULL) OR
    (user_id IS NULL AND placeholder_id IS NOT NULL)
  ),
  CONSTRAINT unique_user_group UNIQUE (group_id, user_id),
  CONSTRAINT one_owner_per_group UNIQUE (group_id, role) WHERE role = 'owner'
);
```

---

### `placeholders`

Represents a non-registered person within a group. Phone or email stored optionally for auto-matching on signup.

```sql
CREATE TABLE placeholders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  display_name          TEXT NOT NULL,
  phone                 TEXT,
  email                 TEXT,
  claimed_by_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Claiming rule:** On new user signup, phone/email is matched against unclaimed placeholders. User reviews and confirms each match individually. Partial claiming supported.

> **Edit rule:** Any member can create. Only owner/admin can edit `display_name`, `phone`, or `email` after creation.

> **Unclaimed rule:** Balance and history persist until the group is deleted. Owner/admin can manually record payments to zero an orphaned balance.

---

### `expenses`

```sql
CREATE TYPE expense_entry_method AS ENUM ('manual', 'ocr', 'voice', 'standing_order');

CREATE TABLE expenses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  payer_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  payer_placeholder_id  UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  total_amount          NUMERIC(12, 2) NOT NULL,
  currency              TEXT NOT NULL,
  entry_method          expense_entry_method NOT NULL DEFAULT 'manual',
  receipt_image_url     TEXT,
  message_id            UUID REFERENCES messages(id) ON DELETE SET NULL,
  standing_order_id     UUID REFERENCES standing_orders(id) ON DELETE SET NULL,
  idempotency_key       TEXT UNIQUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,

  CONSTRAINT payer_xor_placeholder CHECK (
    (payer_user_id IS NOT NULL AND payer_placeholder_id IS NULL) OR
    (payer_user_id IS NULL AND payer_placeholder_id IS NOT NULL)
  )
);
```

> **No status field.** An expense is either active (no `deleted_at`) or deleted. Balances are always computed live.

---

### `line_items`

```sql
CREATE TABLE line_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id          UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  amount              NUMERIC(12, 2) NOT NULL,
  is_tax              BOOLEAN NOT NULL DEFAULT false,
  is_tip              BOOLEAN NOT NULL DEFAULT false,
  ocr_confidence      NUMERIC(3, 2),
  position            INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### `line_item_splits`

```sql
CREATE TABLE line_item_splits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id        UUID NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
  expense_id          UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  placeholder_id      UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  amount              NUMERIC(12, 2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT line_split_xor_placeholder CHECK (
    (user_id IS NOT NULL AND placeholder_id IS NULL) OR
    (user_id IS NULL AND placeholder_id IS NOT NULL)
  )
);
```

> **Unassigned items:** If a line item has no `line_item_splits` rows, its full amount is attributed to the payer.

> **Split across members:** A single line item can have multiple rows. Sum must equal `line_items.amount`.

---

### `payments`

```sql
CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  from_placeholder_id   UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  to_user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  to_placeholder_id     UUID REFERENCES placeholders(id) ON DELETE SET NULL,
  amount                NUMERIC(12, 2) NOT NULL,
  currency              TEXT NOT NULL,
  note                  TEXT,
  message_id            UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,

  CONSTRAINT payment_from_xor_placeholder CHECK (
    (from_user_id IS NOT NULL AND from_placeholder_id IS NULL) OR
    (from_user_id IS NULL AND from_placeholder_id IS NOT NULL)
  ),
  CONSTRAINT payment_to_xor_placeholder CHECK (
    (to_user_id IS NOT NULL AND to_placeholder_id IS NULL) OR
    (to_user_id IS NULL AND to_placeholder_id IS NOT NULL)
  )
);
```

---

### `messages`

```sql
CREATE TYPE message_type AS ENUM (
  'user_text',
  'expense_card',
  'system_event',
  'expense_reply'
);

CREATE TABLE messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  message_type        message_type NOT NULL,
  body                TEXT,
  expense_id          UUID REFERENCES expenses(id) ON DELETE SET NULL,
  payment_id          UUID REFERENCES payments(id) ON DELETE SET NULL,
  parent_message_id   UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
```

---

### `mentions`

```sql
CREATE TABLE mentions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  group_id            UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  mentioned_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, mentioned_user_id)
);
```

---

### `message_reactions`

```sql
CREATE TABLE message_reactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji               TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
```

---

### `standing_orders`

Recurring expense templates that auto-inject a new Expense Card on a schedule. Recurrence is fully custom — any number + any unit. Split mode is chosen at creation.

```sql
CREATE TYPE recurrence_unit AS ENUM ('day', 'week', 'month', 'year');

CREATE TYPE standing_order_split_mode AS ENUM (
  'fixed',        -- split rule defined once, applied automatically each firing
  'collaborative' -- items start unassigned each time, members assign in chat
);

CREATE TABLE standing_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  payer_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,

  title                 TEXT NOT NULL,
  total_amount          NUMERIC(12, 2) NOT NULL,

  -- Custom recurrence: e.g. every 2 weeks = recurrence_every=2, recurrence_unit='week'
  recurrence_every      INTEGER NOT NULL CHECK (recurrence_every > 0),
  recurrence_unit       recurrence_unit NOT NULL,

  -- Split mode chosen at creation
  split_mode            standing_order_split_mode NOT NULL DEFAULT 'collaborative',

  -- split_rule is used only when split_mode = 'fixed'.
  -- JSONB structure matches the split_rule format used in expenses.
  -- NULL when split_mode = 'collaborative'.
  split_rule            JSONB,

  -- Scheduling
  first_run_at          TIMESTAMPTZ NOT NULL, -- explicitly set by user at creation
  next_run_at           TIMESTAMPTZ NOT NULL,
  last_run_at           TIMESTAMPTZ,

  -- Failure tracking
  last_error            TEXT,
  last_error_at         TIMESTAMPTZ,
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  -- Auto-paused after 3 consecutive failures. Owner/admin must manually re-activate.

  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fixed_split_requires_rule CHECK (
    split_mode = 'collaborative' OR split_rule IS NOT NULL
  )
);
```

> **Recurrence examples:**
> - Every week: `recurrence_every=1, recurrence_unit='week'`
> - Every 2 weeks: `recurrence_every=2, recurrence_unit='week'`
> - Every month: `recurrence_every=1, recurrence_unit='month'`
> - Every 3 months: `recurrence_every=3, recurrence_unit='month'`

> **Failure rule:** After 3 consecutive failures (`consecutive_failures >= 3`), `is_active` is set to `false` automatically. A `standing_order_failed` notification is sent to all group admins and the owner. The order must be manually reviewed and re-activated.

> **Split rule constraint:** If `split_mode = 'fixed'`, `split_rule` must be non-null. If `split_mode = 'collaborative'`, `split_rule` is null and ignored.

> **Recurring icon:** Expenses generated by a standing order have `entry_method = 'standing_order'`. The UI uses this field to render the 🔁 icon on the Expense Card.

---

### `notifications`

```sql
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

CREATE TABLE notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id            UUID REFERENCES groups(id) ON DELETE CASCADE,
  expense_id          UUID REFERENCES expenses(id) ON DELETE SET NULL,
  payment_id          UUID REFERENCES payments(id) ON DELETE SET NULL,
  message_id          UUID REFERENCES messages(id) ON DELETE SET NULL,
  notification_type   notification_type NOT NULL,
  body                TEXT NOT NULL,
  is_read             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Notification body rule:** All bodies are generic. Examples: *"Khalid edited an expense in Dubai Trip"*, *"Sara paid Ahmed in Dubai Trip"*. No situation-specific copy.

> **Batching rule:** Multiple `item_reassigned` notifications to the same user within 5 minutes are collapsed into one.

---

## Key Indexes

```sql
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
```

---

## Row-Level Security Policies (Summary)

Full RLS SQL is defined in `supabase/migrations/`.

| Table | Read | Write |
|---|---|---|
| `users` | Own row only | Own row only |
| `groups` | Members of the group | Owner or admin |
| `group_members` | Members of same group | Owner or admin |
| `placeholders` | Members of the group | Any member (create); owner or admin (edit) |
| `expenses` | Members of the group | Any member (create, edit); creator or admin/owner (delete) |
| `line_items` | Members of the group | Any member (via expense edit) |
| `line_item_splits` | Members of the group | Any member |
| `payments` | Members of the group | Owner or admin (on behalf of placeholder); any member (own payment); creator or admin/owner (delete) |
| `messages` | Members of the group | Any member (send); own message (delete) |
| `mentions` | Members of the group | System only |
| `message_reactions` | Members of the group | Any member |
| `standing_orders` | Members of the group | Any member (create, edit, pause); owner or admin (delete) |
| `notifications` | Own rows only | System only |

---

## Triggers & Automation (Summary)

| Trigger | On | Action |
|---|---|---|
| Balance recalculation | INSERT / UPDATE / DELETE on `expenses` or `payments` | Balances computed live; trigger fires Realtime broadcast to update connected clients |
| Post system message on expense create | INSERT on `expenses` | Insert `system_event` message: *"[creator] added [title]"* |
| Post system message on expense edit | UPDATE on `expenses` | Insert `system_event` message: *"[editor] edited [title]"* |
| Post system message on expense delete | UPDATE `deleted_at` on `expenses` | Insert `system_event` message: *"[actor] deleted [title]"* |
| Post system message on payment | INSERT on `payments` | Insert `system_event` message: *"[from] paid [to] · $[amount]"* |
| Mention notification | INSERT on `mentions` | Insert `mention` notification for each mentioned user |
| Item reassignment notification | INSERT / UPDATE on `line_item_splits` where `user_id` changes | Insert batched `item_reassigned` notification to affected user |
| Owner transfer | DELETE on `users` or UPDATE `deleted_at` on `users` | Reassign `groups.owner_id` to earliest `joined_at` member |
| Placeholder claim check | INSERT on `users` | Check new user's email/phone against unclaimed placeholders; if matches found, trigger `placeholder_claim_available` notification |
| Standing order execution | Scheduled (pg_cron, daily at 00:05 UTC) | For each active order where `next_run_at <= now()`: insert `expenses` + `line_items` + optional `line_item_splits` (fixed mode) + `system_event` message; update `next_run_at`; reset `consecutive_failures` on success |
| Standing order failure handling | On standing order execution error | Increment `consecutive_failures`; set `last_error` + `last_error_at`; if `consecutive_failures >= 3`: set `is_active = false`, send `standing_order_failed` notification to owner + all admins |
