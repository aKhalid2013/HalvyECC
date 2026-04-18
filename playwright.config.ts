import { defineConfig, devices } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';

// Load test environment (local Supabase credentials, TEST_USER_EMAIL)
dotenvConfig({ path: '.env.test' });

export default defineConfig({
  testDir: './e2e/web',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'setup-safari',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'Desktop Safari',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/user-safari.json',
      },
      dependencies: ['setup-safari'],
    },
    {
      name: 'Mobile Chrome (Pixel 7)',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari (iPhone 14)',
      use: {
        ...devices['iPhone 14'],
        storageState: 'e2e/.auth/user-safari.json',
      },
      dependencies: ['setup-safari'],
    },
  ],
  webServer: {
    command: 'npx expo start --web --port 8081',
    port: 8081,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
