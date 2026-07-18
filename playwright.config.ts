import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  use: { baseURL: 'http://127.0.0.1:5173' },
  webServer: {
    command: 'pnpm --filter @topthis/web dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
