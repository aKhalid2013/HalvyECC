---
name: halvy-expense-logic
description: >
  Halvy domain logic: living balance model, split types, largest remainder
  rounding, debt graph simplification, integer cents rule, standing orders,
  proportional tax/tip. Triggers: "split", "balance", "expense", "payment",
  "settlement", "debt", "standing order", "cents", "rounding".
---

# Halvy Expense Logic — Domain Rules

## The Golden Rule: Integer Cents Only
ALL monetary values stored and computed in integer cents. No floats in financial logic.

```ts
// CORRECT
const amountCents: number = 1050  // $10.50
const splitCents: number = Math.round(amountCents / members.length)

// NEVER
const amount: number = 10.50
const split: number = amount / members.length  // float errors
```

## Living Balance Model
- Every event is a balance entry — no "locked" or "settled" states
- Balances computed live from all active expenses + payments
- Payments are immutable ledger facts — affect balances permanently
- Expense edits cascade immediately — no manual recalculation needed
- An expense with no `line_item_splits` → full amount attributed to payer

## Split Types
1. **Equal** — divide total evenly, largest remainder handles rounding
2. **Percentage** — each member gets a fixed % of total
3. **Fixed amount** — each member gets a specific dollar amount
4. **Income ratio** — split proportional to member incomes
5. **Item-based** — default for OCR/voice — assign line items individually

## Largest Remainder Algorithm (MANDATORY for equal splits)
Prevents rounding errors from summing to ≠ total.

```ts
function equalSplitCents(totalCents: number, memberCount: number): number[] {
  const base = Math.floor(totalCents / memberCount)
  const remainder = totalCents - base * memberCount
  return Array.from({ length: memberCount }, (_, i) =>
    i < remainder ? base + 1 : base
  )
}
// Example: $10.00 / 3 → [334, 333, 333] cents (sums to 1000 ✓)
```

## Proportional Tax & Tip
Tax and tip are NEVER split equally. Always distributed proportionally.

```ts
function applyProportionalTax(
  itemAmountsCents: number[],
  taxCents: number
): number[] {
  const subtotal = itemAmountsCents.reduce((a, b) => a + b, 0)
  const rawShares = itemAmountsCents.map(a => (a / subtotal) * taxCents)
  // Apply largest remainder to tax shares
  return largestRemainder(rawShares, taxCents)
}
```

## Debt Graph Simplification
Minimise number of transactions to zero all balances.

```ts
// Input: member balance array (positive = owed to, negative = owes)
// Output: minimum set of from→to payment suggestions
function simplifyDebts(balances: MemberBalance[]): SettlementSuggestion[] {
  const creditors = balances.filter(b => b.balance > 0).sort(desc)
  const debtors   = balances.filter(b => b.balance < 0).sort(asc)
  // Greedy matching — pair largest creditor with largest debtor
  // until all balances are zeroed
}
```

## Payer Exclusion
The payer can be excluded from splits (company card, paying on behalf):
- Set `payerExcluded: true` on the expense
- Remaining members split the full amount

## Unassigned Items → Payer Attribution
```ts
// If a line item has no line_item_splits rows:
// → its full amount is attributed to the payer's balance
// This is the default state immediately after expense creation
```

## Standing Orders
- Fire on schedule → inject standard Expense Card into chat
- `split_mode: 'fixed'` → splits pre-applied, no action needed
- `split_mode: 'collaborative'` → items start unassigned (same as manual)
- Expenses from standing orders: `entry_method = 'standing_order'`
- UI renders 🔁 icon on cards where `entry_method === 'standing_order'`
- Failure: retry 3× with exponential backoff → auto-pause + notify admins

## Settlement Calculation
- Computed ON DEMAND — never persisted
- Recalculates automatically as ledger changes
- `recordPayment()` creates a payment entry → immediately updates balances
- Minimum transactions guaranteed by debt graph algorithm

## Key Constraints
- `payer_user_id XOR payer_placeholder_id` — never both, never neither
- `user_id XOR placeholder_id` on splits — same constraint
- `consecutive_failures >= 3` → standing order `is_active = false`
- `split_mode = 'fixed'` → `split_rule` must be non-null
- Payment deletion is soft — `deleted_at` set, balance reversal computed
