---
name: playwright-web-e2e
description: >
  Playwright E2E testing for Halvy's Expo web platform. Use when writing
  browser automation tests, page objects, or multi-browser coverage.
  Triggers: "playwright", "web E2E", "browser test", "e2e web",
  "page object", "web automation", "Playwright test", "end-to-end web".
origin: Halvy ECC
sources:
  - https://playwright.dev/docs/intro
  - https://playwright.dev/docs/best-practices
  - https://playwright.dev/docs/pom
  - https://playwright.dev/docs/emulation
---

# Playwright Web E2E — Halvy

## Overview

Tests run against the Expo web build. Config (`playwright.config.ts`) covers:
- Desktop Chrome, Desktop Safari
- Mobile Chrome (Pixel 7), Mobile Safari (iPhone 14)

Auth state is saved once in `e2e/.auth/user.json` by `auth.setup.ts` and
reused across all tests — no re-login per test.

## File Structure

```
e2e/web/
  auth.setup.ts              ← saves auth state once
  expense-split.spec.ts      ← expense creation + split
  group-management.spec.ts
  settlement.spec.ts
  page-objects/
    GroupsPage.ts
    ExpensePage.ts
    AuthPage.ts
  fixtures/
    testData.ts
```

## Page Object Model

```typescript
// e2e/web/page-objects/GroupsPage.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class GroupsPage {
  readonly newExpenseBtn: Locator;

  constructor(readonly page: Page) {
    this.newExpenseBtn = page.getByRole('button', { name: /new expense/i });
  }

  async goto() {
    await this.page.goto('/groups');
    await expect(this.page).toHaveURL(/\/groups/);
  }

  async openNewExpense() {
    await this.newExpenseBtn.click();
    await expect(this.page.getByRole('heading', { name: /new expense/i })).toBeVisible();
  }
}
```

## Test Pattern

```typescript
// e2e/web/expense-split.spec.ts
import { test, expect } from '@playwright/test';
import { GroupsPage } from './page-objects/GroupsPage';

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Expense split flow', () => {
  test('user can create an expense with equal split', async ({ page }) => {
    const groupsPage = new GroupsPage(page);
    await groupsPage.goto();
    await groupsPage.openNewExpense();
    await page.getByLabel('Amount').fill('300');
    await page.getByRole('button', { name: /split equally/i }).click();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('300')).toBeVisible();
  });
});
```

## Selector Priority

```typescript
// 1. Role + name (best — accessibility-driven)
page.getByRole('button', { name: 'Save Expense' })
page.getByRole('textbox', { name: 'Amount' })

// 2. Label
page.getByLabel('Description')

// 3. testID (add testID prop to RN components)
page.getByTestId('expense-amount-input')

// 4. Text (fragile to copy changes)
page.getByText('Split equally')

// 5. CSS selector (avoid completely)
page.locator('.expense-form button')
```

## API Mocking

```typescript
test('shows error when server fails', async ({ page }) => {
  await page.route('**/rest/v1/expenses*', (route) =>
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Error' }) })
  );
  await groupsPage.openNewExpense();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toContainText(/failed|error/i);
});
```

## Running Tests

```bash
npm run test:web-e2e                          # All browsers
npm run test:web-e2e:ui                       # Visual debug mode
npx playwright test --project="Mobile Chrome (Pixel 7)"  # One browser
npx playwright test e2e/web/expense-split.spec.ts         # One file
npx playwright test --headed                               # See browser
```
