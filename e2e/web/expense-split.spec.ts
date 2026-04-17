import { test, expect } from '@playwright/test';

// Reuse auth state saved by auth.setup.ts
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('Expense split flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/groups');
  });

  test('groups page loads for authenticated user', async ({ page }) => {
    await expect(page).toHaveURL(/\/groups/);
    // Update this selector to match your actual groups screen once built
    await expect(
      page.locator('text=Halvy').or(page.getByTestId('groups-screen'))
    ).toBeVisible({ timeout: 10000 });
  });
});
