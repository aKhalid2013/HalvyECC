---
name: zod-patterns
description: >
  Zod runtime validation patterns for Halvy. Use when data enters the app
  from any external source: Supabase, Gemini API, deep links, push payloads,
  or form inputs. Triggers: "validate", "schema", "parse", "zod",
  "runtime validation", "type guard", "safeParse", "form validation".
origin: Halvy ECC
sources:
  - https://zod.dev
  - https://supabase.com/docs/guides/api/rest/generating-types
---

# Zod Validation Patterns — Halvy

## Core Rules

1. **All external data passes through Zod** before use. No exceptions.
   Sources: Supabase responses, Gemini API output, deep link params, push payloads.
2. **Always use `.safeParse()`**, never `.parse()`. Do not throw at runtime.
3. **Derive TypeScript types from schemas**: `type Expense = z.infer<typeof ExpenseSchema>`.
   Never define a type and schema separately for the same shape.
4. **Shared schemas**: `src/shared/schemas/`. Feature schemas: `src/features/{name}/types/schemas.ts`
5. **Validation failures are logged** and surfaced as user-friendly errors. Never silent.

## Schema + Type Definition

```typescript
// src/shared/schemas/expense.ts
import { z } from 'zod';

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  created_by: z.string().uuid(),
  description: z.string().min(1).max(500),
  total_cents: z.number().int().positive(),
  currency: z.string().length(3),
  split_type: z.enum(['equal', 'exact', 'percentage', 'shares']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Type derived from schema — never define separately
export type Expense = z.infer<typeof ExpenseSchema>;

export const CreateExpenseSchema = ExpenseSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type CreateExpense = z.infer<typeof CreateExpenseSchema>;
```

## Validating Supabase Responses

```typescript
import { z } from 'zod';
import { ExpenseSchema } from '@/shared/schemas/expense';

const ExpenseListSchema = z.array(ExpenseSchema);

export async function getGroupExpenses(groupId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('group_id', groupId);

  if (error) throw new Error(`DB error: ${error.message}`);

  const result = ExpenseListSchema.safeParse(data);
  if (!result.success) {
    console.error('Expense validation failed:', result.error.flatten());
    throw new Error('Received unexpected data shape from database');
  }
  return result.data;
}
```

## Validating Gemini AI Output

```typescript
export const ReceiptParseResultSchema = z.object({
  total_cents: z.number().int().positive(),
  currency: z.string().length(3),
  merchant: z.string().optional(),
  date: z.string().datetime().optional(),
  items: z.array(z.object({
    description: z.string(),
    amount_cents: z.number().int().positive(),
    quantity: z.number().int().positive().default(1),
  })),
});

export type ReceiptParseResult = z.infer<typeof ReceiptParseResultSchema>;

export function parseGeminiReceiptResponse(rawJson: unknown): ReceiptParseResult {
  const result = ReceiptParseResultSchema.safeParse(rawJson);
  if (!result.success) {
    console.error('Gemini validation failed:', result.error.flatten());
    throw new Error('AI returned unexpected format — please try again or enter manually');
  }
  return result.data;
}
```

## Form Validation

```typescript
export const NewExpenseFormSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  amountString: z
    .string()
    .min(1, 'Amount is required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (e.g. 150 or 150.50)'),
  splitType: z.enum(['equal', 'exact', 'percentage', 'shares']),
  groupId: z.string().uuid(),
});

export type NewExpenseForm = z.infer<typeof NewExpenseFormSchema>;

// Convert validated string amount to cents (only call AFTER validation)
export function amountStringToCents(amountString: string): number {
  return Math.round(parseFloat(amountString) * 100);
}
```
