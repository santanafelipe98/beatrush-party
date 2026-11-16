import { expect, test } from "@playwright/test";

test("/healthz responde 200 sem passar pelo Next (sem cookies nem HTML)", async ({ request }) => {
  const res = await request.get("/healthz");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(res.headers()["set-cookie"]).toBeUndefined();
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("/readyz: pronto, com a persistência em memória informada", async ({ request }) => {
  const res = await request.get("/readyz");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok", checks: { app: "up", redis: "disabled" } });
});

test("o jogo continua servido normalmente ao lado dos endpoints de saúde", async ({ page }) => {
  await page.goto("/host");
  await expect(page.getByTestId("room-code")).toBeVisible();
});
