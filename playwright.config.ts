import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @topthis/server dev',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: true,
      env: {
        TOPTHIS_E2E_SEED: '0',
        TOPTHIS_E2E_TARGET_SCORE: '3',
        TOPTHIS_E2E_TURN_DURATION_MS: '5000',
        TOPTHIS_E2E_BOT_DELAY_MS: '100',
        TOPTHIS_E2E_BOT_SKIP_CHANCE: '0',
        TOPTHIS_E2E_ROUND_DELAY_MS: '1000',
      },
    },
    {
      command: 'pnpm --filter @topthis/web dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
    },
  ],
});
