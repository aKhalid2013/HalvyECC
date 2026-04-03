# expense-logic.md
**Project:** Halvy — Next-Gen Social Expense Splitting Ecosystem
**Version:** 3.0
**Depends on:** schema.md, api-contracts.md

> **v2.0 changes:** Removed lock/settle/flag flow entirely. Added collaborative item assignment model. Added living balance model. Added edit and delete rules. Removed `expense_splits` settled logic and `confirmSettlement`. Expenses have no status field.

> **v3.0 changes:** Fixed monetary arithmetic throughout — all calculation functions now operate exclusively in integer cents to eliminate IEEE 754 floating-point errors. `largestRemainder()` rewritten to accept and return cents. `computeMemberBalance()` and `computeSettlements()` rewritten to operate in cents. Validation tolerances updated to match cents-based comparisons. Added cents conversion rule to Assumptions table. Display formatting moved exclusively to `currency.ts`.

---

## Assumptions & Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Expense status | None — expenses are either active or deleted | No locked/settled state; balances are always live |
| Item assignment | Collaborative — any member, any time | Matches real group dynamics; no single gatekeeper |
| Unassigned items | Default to payer's tab | Fairest fallback; payer chose to pay so leftover is theirs |
| Single item split | Supported across multiple members | Common real-world case (shared bottle, shared dish) |
| Balance model | Live net of all expenses + payments | No cached settlement table; always accurate |
| Edit permissions | Any group member | Collaborative; mirrors assign/claim philosophy |
| Delete permissions | Creator + group admin/owner | More consequential than editing; restricted accordingly |
| Discount support | None in v1 | Keeps split calculation simple and predictable |
| Tax/tip base | Per-user subtotal from assigned line items | Proportional and accurate |
| Rounding method | Largest remainder method | Fairest distribution of rounding cents |
| Split sum tolerance | 0 cents (exact match required) | Integer arithmetic is exact; no tolerance needed |
| Monetary arithmetic | Integer cents throughout JS layer | Eliminates IEEE 754 float errors entirely. Convert to cents on entry; format for display on output only. |
| Payer exclusion | Supported | Company card and proxy payment scenarios |
| Debt graph scope | Per group only | Cross-group simplification deferred |
| Settlement calculation | On-demand, never persisted | Snapshot of current balances; recalculates live |
| Notifications on edit | Generic — affected members notified | *"Khalid edited Dinner at Nobu"* — no amount specifics |
| Notification batching | Item reassignment notifications batched per 5min window | Reduces noise during active collaborative assignment |
| Standing order timing | Fixed calendar date | Matches real-world recurring bill cycles |

---

## Monetary Arithmetic Rule

**All calculation functions in this file operate exclusively in integer cents.**

```typescript
// ✅ Correct — working in cents
const totalCents = amountToCents(expense.total_amount)  // e.g. 9375 for $93.75
const shareCents = largestRemainder(totalCents, members)

// ❌ Never — dollar floats in calculations
const share = expense.total_amount * proportion  // float error accumulates
```

Conversion utilities live in `src/utils/currency.ts`:

```typescript
export function amountToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToAmount(cents: number): number {
  return cents / 100
}
```

**Flow for every calculation:**
1. Read `NUMERIC(12,2)` value from database (arrives as JS `number`, e.g. `93.75`)
2. Convert immediately: `const totalCents = amountToCents(expense.total_amount)` → `9375`
3. All arithmetic inside the function uses only integer operations on cents
4. Write back to database: `centsToAmount(shareCents)` → `93.75`
5. Display to user: `formatCurrency(shareCents)` from `currency.ts`

---

## 1. Expense Lifecycle

An expense has no formal status. Its lifecycle is simply:

```
Created → [items assigned collaboratively] → [edited any time] → [deleted if needed]
```

At every moment, each member's balance reflects the live net of all active expenses and recorded payments. There is no lock step, no confirmation, no settled state.

### 1.1 Creation

Any group member can add an expense via OCR, voice, or manual entry. All three methods produce the same unified expense card posted to the group chat. On creation:

- All line items are posted with **no assignments** (`line_item_splits` is empty)
- The payer's balance is credited for the full amount
- All other members' balances are debited equally as a starting default until items are assigned
- A `system_event` message is posted: *"Ahmed added Hotel Atlantis"*

### 1.2 Collaborative Item Assignment

After an expense is posted, any group member can open the card and assign items:

- **Assign to one person:** Creates a `line_item_splits` row for that person for the full item amount
- **Split across multiple people:** Creates multiple `line_item_splits` rows for the same `line_item_id`, amounts summing to the item total
- **Reassign:** Deleting and recreating `line_item_splits` rows. If reassigning from another member's claimed item, a batched `item_reassigned` notification is sent to the affected member
- **Unassign:** Deleting `line_item_splits` rows returns the item to the payer's tab
- Balances recalculate automatically after every assignment change

### 1.3 Unassigned Items

If a line item has no `line_item_splits` rows, its amount is attributed entirely to the payer. This is the default state immediately after posting. Unassigned items are visually indicated on the expense card with the label *"stays on [payer name]"*.

### 1.4 Editing

Any group member can edit an expense at any time. Editable fields:

- Title
- Total amount
- Payer
- Line items (full replacement — add, remove, change amounts)
- Item assignments (full replacement)

On save, balances recalculate immediately. A `system_event` message is posted: *"[member] edited [expense title]"*. A generic `expense_edited` notification is sent to all group members.

### 1.5 Deletion

Creator and group admin/owner can delete an expense. Deletion is a soft delete (`deleted_at` is set). The expense's balance contribution is immediately reversed for all members. A `system_event` message is posted: *"[member] deleted [expense title]"*. The expense card in chat shows as struck through.

---

## 2. Split Types

Four split types are supported, configured per expense via the assignment UI or standing order `split_rule`:

| Type | Description | Example |
|---|---|---|
| `item` | Members assigned specific line items (default for OCR/voice) | Sara gets the wine, Ahmed gets the steak |
| `equal` | Total divided equally among all included members | $90 dinner → $30 each for 3 people |
| `percentage` | Each member assigned a percentage of the total | Alice 50%, Bob 30%, Carol 20% |
| `fixed` | Each member assigned a fixed amount | Mike owes $30 fixed, rest split equally |
| `income_ratio` | Amounts proportional to declared income ratios | House group: rent split 60/40 by income |

> **Mixed splits:** A single expense can combine item-level assignments with a fallback equal split for unassigned remainder.

---

## 3. Proportional Tax & Tip Distribution

### 3.1 Core Rule

Tax and tip line items are distributed proportionally based on each member's assigned non-tax, non-tip subtotal. If no items are assigned yet, tax and tip fall entirely on the payer.

### 3.2 Algorithm

```
Given:
  line_item_splits = [
    { lineItemId: 1 (Pasta  $20.00 → 2000 cents), userId: Alice  },
    { lineItemId: 2 (Steak  $40.00 → 4000 cents), userId: Bob    },
    { lineItemId: 3 (Salad  $15.00 → 1500 cents), userId: Carol  },
  ]
  tax  = $7.50  → 750 cents
  tip  = $11.25 → 1125 cents

Step 1 — Member subtotals (in cents):
  Alice: 2000  Bob: 4000  Carol: 1500
  groupSubtotal = 7500 cents

Step 2 — Proportional tax+tip (in cents):
  combined = 1875 cents
  Alice: floor(1875 × 2000/7500) = floor(500.0) = 500 cents
  Bob:   floor(1875 × 4000/7500) = floor(1000.0) = 1000 cents
  Carol: floor(1875 × 1500/7500) = floor(375.0) = 375 cents

Step 3 — Apply largest remainder rounding (see Section 4)
  sum = 1875 ✓ — no remainder in this example

Step 4 — Final totals (in cents):
  Alice: 2000 + 500  = 2500 cents ($25.00)
  Bob:   4000 + 1000 = 5000 cents ($50.00)
  Carol: 1500 + 375  = 1875 cents ($18.75)
  Total: 9375 cents ($93.75) ✓
```

### 3.3 Edge Cases

| Scenario | Behaviour |
|---|---|
| Member has 0 cents in assigned items | Receives 0 cents share of tax/tip |
| No items assigned yet | Tax/tip stays on payer until assignments are made |
| Multiple tax lines | Each distributed proportionally and independently, then summed |

---

## 4. Rounding: Largest Remainder Method

### 4.1 Problem
Dividing 100 cents among 3 people yields 33.333... cents. Naive floor gives 99 cents — 1 cent missing.

With integer arithmetic this is exact and deterministic: floor each share, then distribute the remaining cents one at a time to members with the largest fractional remainders.

### 4.2 Algorithm

```typescript
// All inputs and outputs are integer cents.
// `total` — total amount in cents (integer)
// `members` — array of { id: string, proportion: number } where proportions sum to 1.0

function largestRemainder(totalCents: number, members: Member[]): Map<string, number> {
  const exactShares = members.map(m => {
    const exact     = m.proportion * totalCents
    const floored   = Math.floor(exact)
    const remainder = exact - floored          // fractional part, 0 ≤ r < 1
    return { id: m.id, floored, remainder }
  })

  const flooredSum      = exactShares.reduce((sum, s) => sum + s.floored, 0)
  const remainderCents  = totalCents - flooredSum  // integer: cents left to distribute

  // Give 1 extra cent to the members with the largest fractional parts
  const sorted = [...exactShares].sort((a, b) => b.remainder - a.remainder)
  const result = new Map<string, number>()

  sorted.forEach((share, index) => {
    result.set(share.id, share.floored + (index < remainderCents ? 1 : 0))
  })

  return result  // values are integer cents
}
```

### 4.3 Validation
Sum of all split amounts (in cents) must exactly equal the expense total (in cents). Integer arithmetic means there is no tolerance needed — the largest remainder method guarantees an exact sum.

```typescript
const splitSum = [...splits.values()].reduce((a, b) => a + b, 0)
if (splitSum !== totalCents) throw new Error('VALIDATION_ERROR: splits do not sum to total')
```

---

## 5. Payer Exclusion from Splits

The payer can be excluded from splits (e.g. company card, paying on behalf). When excluded, they are recorded as `payer_user_id` but receive no `line_item_splits` share. Their balance benefit is the full expense amount; their personal cost is $0.

```
Expense: $90.00 (9000 cents)  Payer: Alice (excluded)
Others: Bob 3000c, Carol 3000c, Dave 3000c
Alice is owed 9000 cents ($90.00) total by the group.
```

---

## 6. Living Balance Model

### 6.1 How Balances Are Computed

A member's balance in a group is the **live net** of two event types:

1. **Expenses:** `payer` is credited `total_amount`. Each member with assigned items is debited their share. Unassigned items are debited to the payer (net zero for unassigned).
2. **Payments:** `from_user` is debited `amount`. `to_user` is credited `amount`.

```typescript
// All amounts handled as integer cents internally.
// DB values are converted to cents on read; converted back to dollars on write.

function computeMemberBalance(
  userId:   string,
  expenses: Expense[],
  payments: Payment[]
): number {  // returns integer cents
  let balanceCents = 0

  expenses.filter(e => !e.deletedAt).forEach(exp => {
    const totalCents = amountToCents(exp.totalAmount)
    const shareCents = computeMemberShareCents(userId, exp)  // from line_item_splits + tax/tip
    if (exp.payerUserId === userId) {
      balanceCents += totalCents - shareCents  // paid for others
    } else {
      balanceCents -= shareCents               // owes their share
    }
  })

  payments.filter(p => !p.deletedAt).forEach(pay => {
    const amtCents = amountToCents(pay.amount)
    if (pay.toUserId   === userId) balanceCents += amtCents  // received
    if (pay.fromUserId === userId) balanceCents -= amtCents  // paid out
  })

  return balanceCents  // integer cents — convert to dollars only for display
}
```

### 6.2 What a Balance Means

| Balance | Meaning |
|---|---|
| Positive (+) | The group owes this member money |
| Negative (−) | This member owes the group money |
| Zero | Balanced |

### 6.3 Effect of Edits and Deletes

- **Expense edited:** Balance recalculates immediately with new values. All affected members see updated balance pills in real time via Realtime broadcast.
- **Expense deleted:** The expense's contribution is reversed. Payments already recorded remain — they are permanent facts in the ledger.
- **Payment deleted:** The payment's contribution is reversed. Any balance that was reduced by this payment is restored.

---

## 7. Settlement Calculation (On-Demand Snapshot)

### 7.1 Purpose

At any time, any group member can trigger a settlement view. This computes the **minimum number of transfers** needed to zero out all balances given current state.

### 7.2 Algorithm: Net Balance + Greedy Matching

```typescript
// All amounts are integer cents.

function computeSettlements(balancesCents: Record<string, number>): Settlement[] {
  const THRESHOLD = 1  // ignore sub-cent dust (shouldn't occur with integer math, but defensive)

  const debtors   = members
    .filter(m => balancesCents[m.id] < -THRESHOLD)
    .map(m => ({ user: m, amtCents: -balancesCents[m.id] }))

  const creditors = members
    .filter(m => balancesCents[m.id] > THRESHOLD)
    .map(m => ({ user: m, amtCents: balancesCents[m.id] }))

  const txns: Settlement[] = []
  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const amtCents = Math.min(debtors[i].amtCents, creditors[j].amtCents)
    txns.push({
      from:      debtors[i].user,
      to:        creditors[j].user,
      amtCents,
      // Display-only: formatCurrency(amtCents)
    })
    debtors[i].amtCents   -= amtCents
    creditors[j].amtCents -= amtCents
    if (debtors[i].amtCents   < THRESHOLD) i++
    if (creditors[j].amtCents < THRESHOLD) j++
  }

  return txns
}
```

### 7.3 Settlements Are Never Persisted

Settlement suggestions are computed live and shown in the Settle tab / sheet. They are never written to the database. The only database write that occurs is when a member records an actual payment — which creates a `payments` row and updates balances.

### 7.4 Recording a Payment

When a member taps "Record Payment" in the settle view:
1. A `payments` row is created with `from_user_id`, `to_user_id`, and `amount` (stored as `NUMERIC(12,2)` — convert from cents via `centsToAmount` before writing)
2. A `system_event` message is posted to the group chat: *"Ahmed paid Khalid · $85.50"*
3. Balances recalculate live — the settlement view updates immediately
4. A `payment_recorded` notification is sent to the recipient

---

## 8. OCR Confidence Thresholds

| Score | Classification | UI Treatment |
|---|---|---|
| ≥ 0.85 | High | Displayed normally |
| 0.60–0.84 | Medium | Amber left border, soft prompt to verify |
| < 0.60 | Low | Red left border, explicit confirm before submission |

Submission is never blocked — confidence is a soft gate only.

---

## 9. Standing Orders (Recurring Expenses)

### 9.1 Definition
A standing order auto-posts an Expense Card into the group chat on a fixed schedule. It is not a payment instruction — it is a scheduled expense entry.

### 9.2 What Firing Produces

Each fired standing order atomically creates:
1. A new `expenses` row (`entry_method: 'standing_order'`)
2. New `line_items` rows (cloned from `split_rule`)
3. A new `messages` row of type `expense_card`
4. A `standing_order_fired` notification for all group members

> **Note:** No `line_item_splits` are auto-created. Items start unassigned, exactly as with manually posted expenses. Members claim/assign as usual.

### 9.3 Idempotency

Idempotency key format: `standing_order:{order_id}:{next_run_at_iso_date}`

Before firing, the Edge Function checks for an existing expense with this key. If found, it advances `next_run_at` and skips — no duplicate is created.

### 9.4 Failure Handling

- On failure: log error, set `last_error`, do NOT advance `next_run_at`
- After 3 consecutive failures: auto-pause, notify group admin
- Missed orders (past due): fired immediately on next cron run

---

## 10. Validation Rules Summary

All validation runs in `src/features/expenses/utils/splitCalculator.ts` on the client before submission, and is re-enforced in the `create_expense_atomic` and `update_expense_atomic` RPCs on the server.

All comparisons below operate on **integer cents**.

| Rule | Error Code | Condition |
|---|---|---|
| Split sum matches total | `VALIDATION_ERROR` | `sum(splits_cents) !== total_cents` |
| At least one line item | `VALIDATION_ERROR` | `lineItems.length === 0` |
| No negative item amounts | `VALIDATION_ERROR` | Any `amount_cents < 0` |
| Line item split sum matches item amount | `VALIDATION_ERROR` | `sum(line_item_splits_cents) !== line_item_cents` |
| Tax/tip proportions sum to 1.0 | `VALIDATION_ERROR` | `abs(sum(proportions) - 1.0) > 0.001` |
| Percentages sum to 100 | `VALIDATION_ERROR` | `abs(sum(percentages) - 100) > 0.1` |
| Income ratios all positive | `VALIDATION_ERROR` | Any ratio `<= 0` |
| Payer excluded but splits don't cover total | `VALIDATION_ERROR` | Payer excluded and `sum(splits_cents) !== total_cents` |
| Idempotency key unique | `DUPLICATE_EXPENSE` | Expense with same key already exists |
