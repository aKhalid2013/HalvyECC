---
name: universal-e2e
description: >
  Universal E2E architecture — one test file running on iOS + Android (Detox)
  and Web (Playwright) via shared TypeScript interfaces. Use when implementing
  E2E tests that must run identically on all three platforms. Triggers:
  "universal E2E", "cross-platform test", "shared E2E", "one test all platforms",
  "Detox and Playwright together".
origin: Halvy ECC
sources:
  - https://ignitecookbook.com/docs/recipes/UniversalE2ETesting/
---

# Universal E2E — Halvy

## Concept

One TypeScript interface defines actions (`openNewExpense()`, `fillAmount()`).
Detox implements those actions for iOS/Android. Playwright implements them for web.
One test file imports only the interface and runs unchanged on all three platforms.

## Directory Structure

```
e2e/
  universal/
    screens/
      IExpenseScreen.ts       ← TypeScript interface (platform-agnostic)
      IGroupsScreen.ts
    detox/
      screens/
        ExpenseScreen.ts      ← Detox implementation
        GroupsScreen.ts
      entry.ts
    playwright/
      screens/
        ExpenseScreen.ts      ← Playwright implementation
        GroupsScreen.ts
      entry.ts
    tests/
      expense-split.test.ts   ← ONE TEST — runs on all platforms
    fixtures.ts
    entry.ts                  ← picks Detox or Playwright at runtime
```

## Interface Definition

```typescript
// e2e/universal/screens/IExpenseScreen.ts
export interface IExpenseScreen {
  openNewExpense(): Promise<void>;
  fillAmount(amount: string): Promise<void>;
  fillDescription(description: string): Promise<void>;
  selectSplitType(type: 'equal' | 'custom'): Promise<void>;
  save(): Promise<void>;
  assertExpenseVisible(amount: string): Promise<void>;
}

// e2e/universal/fixtures.ts
import type { IExpenseScreen } from './screens/IExpenseScreen';
import type { IGroupsScreen } from './screens/IGroupsScreen';

export type Fixtures = {
  loadApp: () => Promise<void>;
  expenseScreen: IExpenseScreen;
  groupsScreen: IGroupsScreen;
};
```

## Runtime Selector

```typescript
// e2e/universal/entry.ts
export type Test = (name: string, fn: (fixtures: Fixtures) => Promise<void>) => void;

const isDetox = () => typeof (global as Record<string, unknown>).device !== 'undefined';

export const test: Test = (() => {
  if (isDetox()) return require('./detox/entry').test;
  return require('./playwright/entry').test;
})();
```

## Single Test File (all platforms)

```typescript
// e2e/universal/tests/expense-split.test.ts
import { test } from '../entry';

test('user can create and split an expense', async ({ expenseScreen, groupsScreen }) => {
  await groupsScreen.openFirstGroup();
  await expenseScreen.openNewExpense();
  await expenseScreen.fillAmount('300');
  await expenseScreen.fillDescription('Team lunch');
  await expenseScreen.selectSplitType('equal');
  await expenseScreen.save();
  await expenseScreen.assertExpenseVisible('300');
});
```

## Playwright Implementation Example

```typescript
// e2e/universal/playwright/screens/ExpenseScreen.ts
import { type Page, expect } from '@playwright/test';
import type { IExpenseScreen } from '../../screens/IExpenseScreen';

export class ExpenseScreen implements IExpenseScreen {
  constructor(private page: Page) {}

  async openNewExpense() {
    await this.page.getByRole('button', { name: /new expense/i }).click();
    await expect(this.page.getByRole('heading', { name: /new expense/i })).toBeVisible();
  }

  async fillAmount(amount: string) {
    await this.page.getByLabel('Amount').fill(amount);
  }

  async fillDescription(description: string) {
    await this.page.getByLabel('Description').fill(description);
  }

  async selectSplitType(type: 'equal' | 'custom') {
    await this.page.getByRole('button', { name: type === 'equal' ? /split equally/i : /custom/i }).click();
  }

  async save() {
    await this.page.getByRole('button', { name: /save/i }).click();
  }

  async assertExpenseVisible(amount: string) {
    await expect(this.page.getByText(amount)).toBeVisible();
  }
}
```

## Running

```bash
# Web (Playwright)
npm run test:web-e2e

# Mobile (Detox — after eas build --profile e2e)
npx detox test --configuration ios.sim.debug
npx detox test --configuration android.emu.debug
```
