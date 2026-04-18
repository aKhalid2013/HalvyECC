import { expect, test } from '@playwright/test';

// Reuse auth state saved by auth.setup.ts
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Authenticated home screen (Phase 1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('authenticated user sees home screen with display name', async ({ page }) => {
    // Phase 1 home screen shows Welcome + email + Sign Out
    await expect(page.getByText('Welcome')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Sign Out')).toBeVisible();
  });

  test('sign out returns to sign-in screen', async ({ page }) => {
    await expect(page.getByText('Welcome')).toBeVisible({ timeout: 10000 });
    await page.getByText('Sign Out').click();
    await page.waitForURL(/sign-in/, { timeout: 15000 });
    await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 10000 });
  });
});
