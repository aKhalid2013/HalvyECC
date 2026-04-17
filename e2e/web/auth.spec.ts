import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('sign-in screen renders correctly', async ({ page }) => {
    await expect(page.getByText('Halvy', { exact: true })).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('Continue with Apple')).toBeVisible();
    await expect(page.getByText('Sign in with Magic Link')).toBeVisible();
  });

  test('magic link flow journey', async ({ page }) => {
    await page.getByText('Sign in with Magic Link').click();
    await expect(page.getByText('Sign in with email')).toBeVisible();

    const emailInput = page.getByPlaceholder('Email');
    await emailInput.fill('test@example.com');

    const sendButton = page.getByText('Send Magic Link');
    await sendButton.click();

    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();
    
    await page.getByText('Back to sign-in').click();
    await expect(page.getByText('Continue with Google')).toBeVisible();
  });
});
