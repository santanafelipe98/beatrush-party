import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3100",
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      PORT: "3100",
      MUSIC_PROVIDER: "mock",
      VOTE_MS: "15000",
      ROUND_MS: "15000",
      REVEAL_MS: "1500",
      TOTAL_ROUNDS: "2",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
