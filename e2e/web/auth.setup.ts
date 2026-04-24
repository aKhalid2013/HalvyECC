import fs from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'testuser@halvy.app';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set in .env.test');
}

setup('authenticate as test user', async ({ page }, testInfo) => {
  // Each browser project writes its own storageState file
  const isSafari = testInfo.project.name === 'setup-safari';
  const authFile = isSafari
    ? path.join(__dirname, '../.auth/user-safari.json')
    : path.join(__dirname, '../.auth/user.json');

  // Use admin generate_link API to get magic link without sending email
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'magiclink',
      email: TEST_EMAIL,
      options: { redirect_to: 'http://localhost:8081/' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to generate magic link: ${await res.text()}`);
  }

  const { action_link } = (await res.json()) as { action_link: string };

  // Replace the default redirect_to with the correct app URL
  const verifyUrl = action_link.replace(
    /redirect_to=[^&]+/,
    'redirect_to=http%3A%2F%2Flocalhost%3A8081%2F'
  );

  // Navigate to the Supabase verify endpoint — it exchanges the token and redirects to the app
  await page.goto(verifyUrl);

  // Wait for the app to load and auth to complete (home screen shows display name)
  await page.waitForURL(/localhost:8081/, { timeout: 30000 });
  await expect(page.getByText('Welcome')).toBeVisible({ timeout: 15000 });

  // Ensure auth dir exists and save storage state
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
