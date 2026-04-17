import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate as test user', async ({ page }) => {
  await page.goto('/sign-in');

  const testEmail = process.env.TEST_USER_EMAIL;
  if (!testEmail) {
    throw new Error(
      'TEST_USER_EMAIL env var is required for E2E tests. Add it to .env.test'
    );
  }

  await page.getByLabel('Email').fill(testEmail);
  await page.getByRole('button', { name: /send magic link|sign in/i }).click();

  // Wait for redirect to authenticated route
  // Update this URL pattern once your auth flow is built
  await page.waitForURL('**/groups', { timeout: 30000 });
  await expect(page).toHaveURL(/\/groups/);

  await page.context().storageState({ path: authFile });
});
