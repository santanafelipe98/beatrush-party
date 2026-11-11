import { expect, test } from "@playwright/test";

// Regressão: acessando por um host diferente de "localhost" (ex.: IP da rede no celular),
// o Next em dev bloqueia os scripts e a página não hidrata (nada responde).
test("formulário de entrada funciona acessando por outro host que não localhost", async ({ page, baseURL }) => {
  const url = new URL("/play?code=ABCD", baseURL).toString().replace("localhost", "127.0.0.1");
  await page.goto(url);

  await page.getByPlaceholder("Como te chamam?").fill("Ana");
  await expect(page.getByRole("button", { name: "Entrar no Jogo" })).toBeEnabled();

  await page.getByLabel("Avatar 4").click();
  await expect(page.getByLabel("Avatar 4")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Avatar 2")).toHaveAttribute("aria-pressed", "false");
});

// Regressão: em HTTP por IP da rede, `crypto.randomUUID` não existe (contexto inseguro).
test("entra na sala mesmo sem crypto.randomUUID", async ({ browser }) => {
  const tvCtx = await browser.newContext();
  const phoneCtx = await browser.newContext();
  await phoneCtx.addInitScript(() => {
    // @ts-expect-error simulando contexto inseguro
    delete Crypto.prototype.randomUUID;
  });
  const tv = await tvCtx.newPage();
  const phone = await phoneCtx.newPage();

  await tv.goto("/host");
  const code = (await tv.getByTestId("room-code").textContent())!;

  await phone.goto(`/play?code=${code}`);
  expect(await phone.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
  await phone.getByPlaceholder("Como te chamam?").fill("Lan");
  await phone.getByRole("button", { name: "Entrar no Jogo" }).click();
  await expect(phone.getByText("Você está dentro!")).toBeVisible();
  await expect(tv.getByText("Lan (Host)")).toBeVisible();

  await Promise.all([tvCtx.close(), phoneCtx.close()]);
});
