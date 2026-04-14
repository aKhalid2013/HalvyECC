---
name: monetary-patterns
description: >
  Monetary arithmetic patterns using Dinero.js v2. Use whenever creating,
  splitting, displaying, or comparing monetary amounts. Triggers: "amount",
  "cents", "currency", "split", "dinero", "balance", "total", "monetary",
  "money", "EGP", "financial calculation", "integer cents".
origin: Halvy ECC
sources:
  - https://dinerojs.com/docs
  - https://dinerojs.com/docs/guides/money-splitting
---

# Monetary Value Patterns — Halvy

## The Single Rule

**All monetary values are integers in the smallest unit (cents/piastres).**
`150 EGP` → stored and passed as `15000`. Never as `150.0` or `150.50`.
Float arithmetic on money is a bug. Enforce this with Dinero.js.

## Construct via Dinero

```typescript
import { dinero, add, allocate, toSnapshot } from 'dinero.js';
import { EGP, USD } from '@dinero.js/currencies';

const total = dinero({ amount: 15000, currency: EGP }); // 150.00 EGP
const tip   = dinero({ amount: 2500, currency: EGP });   // 25.00 EGP
const grand = add(total, tip);                           // 17500 = 175.00 EGP

// Extract integer for DB storage
const { amount } = toSnapshot(grand); // → 17500
```

## User Input → Cents

```typescript
// User types "150.50" — convert to integer cents ONCE on submit
export function userInputToCents(input: string): number {
  const parsed = parseFloat(input);
  if (isNaN(parsed) || parsed <= 0) throw new Error('Invalid amount');
  return Math.round(parsed * 100); // Math.round handles float imprecision
}
```

## Display Cents → String (formatting only, never do math on this)

```typescript
import { dinero, toDecimal } from 'dinero.js';
import { EGP, USD } from '@dinero.js/currencies';

export function centsToDisplay(cents: number, currencyCode: string): string {
  const map: Record<string, typeof EGP> = { EGP, USD };
  const currency = map[currencyCode] ?? EGP;
  const d = dinero({ amount: cents, currency });
  return toDecimal(d, ({ value, currency }) =>
    `${currency.code} ${parseFloat(value).toFixed(2)}`
  );
}
// centsToDisplay(15050, 'EGP') → "EGP 150.50"
```

## Equal Split (distributes remainder fairly)

```typescript
import { dinero, allocate, toSnapshot } from 'dinero.js';
import { EGP } from '@dinero.js/currencies';

// 100 EGP / 3 people → [3334, 3333, 3333] cents — first person gets the extra cent
export function splitEqually(totalCents: number, count: number): number[] {
  const d = dinero({ amount: totalCents, currency: EGP });
  const ratios = Array(count).fill(1);
  return allocate(d, ratios).map((share) => toSnapshot(share).amount);
}
// splitEqually(10000, 3) → [3334, 3333, 3333] — sum = 10000 ✓
```

## Exact Split Validation

```typescript
export function validateExactSplit(
  totalCents: number,
  splitAmounts: number[]
): { valid: boolean; difference: number } {
  const splitTotal = splitAmounts.reduce((s, a) => s + a, 0);
  return {
    valid: splitTotal === totalCents,
    difference: totalCents - splitTotal,
  };
}
```

## Forbidden Patterns

```typescript
// ❌ Float arithmetic
const share = 100.0 / 3; // → 33.333...

// ❌ Storing float in DB
{ amount: 150.50 }

// ❌ JS multiplication without rounding
const fee = 1.10 * 0.05; // → 0.055000000000000007

// ✅ Everything in integer cents
const totalCents = 15050;
const feeCents = Math.round(totalCents * 0.05);
const halves = splitEqually(totalCents, 2);
```
