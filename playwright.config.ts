import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Preem HR E2E Tests
 *
 * Tests EPIC-10 (Employee Termination & Offboarding) compliance features:
 * - Notice period calculation
 * - Severance calculation (30%/35%/40%)
 * - Document generation (work certificate, CNPS attestation, final payslip)
 * - Job search time tracking (2 days/week)
 * - Email notifications
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
