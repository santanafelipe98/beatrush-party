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
