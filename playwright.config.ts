import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3100",
    env: { PORT: "3100", MUSIC_PROVIDER: "mock" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
