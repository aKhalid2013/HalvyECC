# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate as test user
- Location: e2e\web\auth.setup.ts:6:6

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Email')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic:
    - img
```

# Test source

```ts
  1  | import { test as setup, expect } from '@playwright/test';
  2  | import path from 'path';
  3  | 
  4  | const authFile = path.join(__dirname, '../.auth/user.json');
  5  | 
  6  | setup('authenticate as test user', async ({ page }) => {
  7  |   await page.goto('/sign-in');
  8  | 
  9  |   const testEmail = process.env.TEST_USER_EMAIL;
  10 |   if (!testEmail) {
  11 |     throw new Error(
  12 |       'TEST_USER_EMAIL env var is required for E2E tests. Add it to .env.test'
  13 |     );
  14 |   }
  15 | 
> 16 |   await page.getByLabel('Email').fill(testEmail);
     |                                  ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  17 |   await page.getByRole('button', { name: /send magic link|sign in/i }).click();
  18 | 
  19 |   // Wait for redirect to authenticated route
  20 |   // Update this URL pattern once your auth flow is built
  21 |   await page.waitForURL('**/groups', { timeout: 30000 });
  22 |   await expect(page).toHaveURL(/\/groups/);
  23 | 
  24 |   await page.context().storageState({ path: authFile });
  25 | });
  26 | 
```