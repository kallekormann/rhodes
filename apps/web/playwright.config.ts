import { defineConfig, devices } from "@playwright/test";

const port = process.env.RHODES_E2E_PORT ?? "3001";
const baseURL = process.env.RHODES_E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e/offline",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    storageState: process.env.RHODES_E2E_AUTH_FILE ?? "tests/e2e/.auth/user-a.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.RHODES_E2E_NO_SERVER
    ? undefined
    : {
        command: `pnpm dev --port ${port}`,
        url: `${baseURL}/app`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
