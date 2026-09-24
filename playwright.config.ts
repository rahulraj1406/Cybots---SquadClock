import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: two or three real browsers using the app together
 * against a production build and a local Supabase stack.
 *
 *   npx supabase start
 *   npm run build      # with .env.local pointing at the local stack
 *   npm run test:e2e
 */
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
