import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./src/tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173/Explore-Math/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 4173",
    url: "http://127.0.0.1:4173/Explore-Math/",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
