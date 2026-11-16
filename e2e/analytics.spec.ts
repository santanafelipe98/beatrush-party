import { expect, test } from "@playwright/test";

/**
 * Consentimento do Google Analytics. O servidor de teste só liga o Analytics com `E2E_GA=on`
 * (`npm run test:e2e:analytics`): com ele ligado o banner aparece em todas as telas e atrapalharia
 * os outros testes, por isso a bateria padrão roda sem ID e estes testes ficam pulados.
 */
const GA_ON = process.env.E2E_GA === "on";
const gaTest = GA_ON ? test : test.skip;

const isGtag = (url: string) => url.includes("googletagmanager.com/gtag/js");

gaTest("nada do Google carrega antes do aceite; aceitar carrega; a escolha persiste", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const requests: string[] = [];
  await ctx.route(/googletagmanager\.com|google-analytics\.com/, (r) => {
    requests.push(r.request().url());
    return r.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });

  await page.goto("/host");
  await expect(page.getByTestId("consent-banner")).toBeVisible();
  await page.waitForTimeout(800);
  expect(requests.filter(isGtag), "GA carregou antes do consentimento").toHaveLength(0);

  await page.getByTestId("consent-accept").click();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  await expect.poll(() => requests.some((u) => isGtag(u) && u.includes("G-E2ETEST123"))).toBe(true);

  // volta ao app: sem banner, e o GA já carrega
  requests.length = 0;
  await page.reload();
  await expect(page.getByTestId("room-code")).toBeVisible();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  await expect.poll(() => requests.some(isGtag)).toBe(true);
  await ctx.close();
});

gaTest("recusar: nenhuma requisição ao Google, nem depois de recarregar", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const requests: string[] = [];
  await ctx.route(/googletagmanager\.com|google-analytics\.com/, (r) => {
    requests.push(r.request().url());
    return r.fulfill({ status: 200, body: "" });
  });
  await page.goto("/host");
  await page.getByTestId("consent-reject").click();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("room-code")).toBeVisible();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(requests, "requisições ao Google após recusar").toHaveLength(0);
  await ctx.close();
});

gaTest("Sobre → Preferências de privacidade reabre o banner para mudar a escolha", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ctx.route(/googletagmanager\.com|google-analytics\.com/, (r) => r.fulfill({ status: 200, body: "" }));
  await page.goto("/host");
  await page.getByTestId("consent-reject").click();
  await page.getByRole("button", { name: "Sobre" }).click();
  await page.getByTestId("privacy-prefs").click();
  await expect(page.getByTestId("consent-banner")).toBeVisible();
  await ctx.close();
});

gaTest("no celular o banner cabe na tela e o botão Entrar no Jogo fica alcançável acima dele", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await ctx.newPage();
  await ctx.route(/googletagmanager\.com|google-analytics\.com/, (r) => r.fulfill({ status: 200, body: "" }));
  await page.goto("/play");
  const banner = page.getByTestId("consent-banner");
  await expect(banner).toBeVisible();
  const box = (await banner.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  // o botão de entrar pode ser rolado para ACIMA do banner (o espaço do banner é reservado no fim da página)
  const joinBtn = page.getByRole("button", { name: "Entrar no Jogo" });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); // rola até o fim
  const join = (await joinBtn.boundingBox())!;
  expect(join.y + join.height, "botão Entrar coberto pelo banner").toBeLessThanOrEqual(box.y);
  await page.getByTestId("consent-accept").click();
  await ctx.close();
});

// com o Analytics desligado (padrão) o app não mostra nada disso
(GA_ON ? test.skip : test)("sem GA_MEASUREMENT_ID não há banner nem menção a Analytics", async ({ page }) => {
  await page.goto("/host");
  await expect(page.getByTestId("room-code")).toBeVisible();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Sobre" }).click();
  await expect(page.getByTestId("privacy-prefs")).toHaveCount(0);
});
