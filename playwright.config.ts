import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", locale: "pt-BR" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3100",
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      PORT: "3100",
      MUSIC_PROVIDER: "mock",
      // marca do Deezer: desligada por padrão; `npm run test:e2e:branding` liga (e roda os testes de logo)
      NEXT_PUBLIC_DEEZER_BRANDING: process.env.E2E_DEEZER_BRANDING === "on" ? "on" : "",
      // Google Analytics: desligado por padrão; `npm run test:e2e:analytics` liga com um ID fictício
      GA_MEASUREMENT_ID: process.env.E2E_GA === "on" ? "G-E2ETEST123" : "",
      VOTE_MS: "15000",
      ROUND_MS: "15000",
      REVEAL_MS: "1500",
      TOTAL_ROUNDS: "2",
      COUNTDOWN_MS: "1500", // contagem curta nos testes (3-2-1 de 0,5 s)
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
