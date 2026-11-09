import { defineConfig, devices } from '@playwright/test';

// Uses a production build served by `vite preview`.
// On your own computer, run `npx playwright install` once first.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, launchOptions: executablePath ? { executablePath } : {} } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } }, testMatch: ['cross.spec.ts', 'smoke.spec.ts'] },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } }, testMatch: ['cross.spec.ts', 'smoke.spec.ts'] },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
