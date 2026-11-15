import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * O arquivo do logo é um Brand Asset do Deezer e NÃO é versionado (ver NOTICE): só existe onde o
 * operador colocou a sua cópia autorizada. Sem ele o app mostra o texto "Powered by Deezer"; estes
 * testes valem para os dois casos (a verificação do arquivo em si só roda quando ele existe).
 */
const HAS_ASSET = existsSync(path.join(process.cwd(), "public", "brand", "deezer", "Signatures-PoweredBy-DE.svg"));

/**
 * MODO: enquanto o Deezer não responde sobre o uso da marca, o app roda com a marca DESLIGADA (padrão)
 * e os testes de logo ficam pulados. `npm run test:e2e:branding` liga a marca e roda a bateria completa.
 */
const BRANDING_ON = process.env.E2E_DEEZER_BRANDING === "on";
const onTest = BRANDING_ON ? test : test.skip;
const offTest = BRANDING_ON ? test.skip : test;

/**
 * A API do Deezer exige "a clearly visible Deezer Logo" em todo app que a usa.
 * Aqui conferimos: carregou de verdade (não é imagem quebrada), tem tamanho legível e NÃO está
 * coberto por outro elemento.
 */
async function expectDeezerLogo(page: Page, where: string) {
  const logo = page.getByTestId("deezer-logo");
  await expect(logo, `logo em ${where}`).toBeVisible();
  // sem o arquivo, o texto aparece logo após o erro de carregamento (espera com retentativa)
  if (!HAS_ASSET) await expect(logo, `logo em ${where}`).toHaveText("Powered by Deezer");
  const info = await logo.evaluate((el) => {
    const img = el as HTMLImageElement;
    const r = img.getBoundingClientRect();
    // amostra uma grade de pontos sobre TODA a área do logo (não só o centro)
    const points: [number, number][] = [];
    for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95])
      for (const fy of [0.15, 0.5, 0.85]) points.push([r.left + r.width * fx, r.top + r.height * fy]);
    return {
      isImage: el.tagName === "IMG",
      loaded: img.complete && img.naturalWidth === 2500 && img.naturalHeight === 367,
      width: r.width,
      height: r.height,
      ratio: r.width / r.height,
      inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      onTop: points.every(([x, y]) => document.elementFromPoint(x, y) === img),
      opacity: getComputedStyle(img).opacity,
    };
  });
  if (HAS_ASSET) {
    expect(info.isImage, `${where}: deveria mostrar a imagem`).toBe(true);
    expect(info.loaded, `${where}: arquivo do logo não carregou`).toBe(true);
    expect(info.ratio, `${where}: proporção alterada`).toBeCloseTo(2500 / 367, 1);
    } else {
    expect(info.isImage, `${where}: sem o arquivo deveria mostrar o texto`).toBe(false);
    await expect(logo).toHaveText("Powered by Deezer");
  }
  expect(info.height, `${where}: logo pequeno demais`).toBeGreaterThanOrEqual(28);
  expect(info.inViewport, `${where}: logo fora da tela`).toBe(true);
  expect(info.onTop, `${where}: logo coberto por outro elemento`).toBe(true);
  expect(info.opacity).toBe("1");
}

onTest("logo na tela inicial, na entrada do celular e na TV", async ({ page }) => {
  await page.goto("/");
  await expectDeezerLogo(page, "tela inicial");
  await page.goto("/play");
  await expectDeezerLogo(page, "entrada do celular");
  await page.goto("/host");
  await expect(page.getByTestId("room-code")).toBeVisible();
  await expectDeezerLogo(page, "TV (lobby)");
});

onTest("logo visível em todas as fases da TV", async ({ browser }) => {
  const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const aCtx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const bCtx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const tv = await tvCtx.newPage();
  const ana = await aCtx.newPage();
  const bob = await bCtx.newPage();

  await tv.goto("/host");
  const code = (await tv.getByTestId("room-code").textContent())!;
  await expectDeezerLogo(tv, "lobby");

  for (const [p, name] of [[ana, "Ana"], [bob, "Bob"]] as const) {
    await p.goto(`/play?code=${code}`);
    await p.getByPlaceholder("Como te chamam?").fill(name);
    await p.getByRole("button", { name: "Entrar no Jogo" }).click();
  }
  await expect(tv.getByText("2 / 8 conectados")).toBeVisible();
  await expectDeezerLogo(tv, "lobby com jogadores");

  await ana.getByRole("button", { name: "Iniciar Seleção de Gêneros" }).click();
  await expect(tv.getByText("Qual vai ser a vibe?")).toBeVisible();
  await expectDeezerLogo(tv, "votação de gêneros");

  await ana.getByRole("button", { name: "Pop" }).click();
  await ana.getByRole("button", { name: "Enviar Votos" }).click();
  await bob.getByRole("button", { name: "Pop" }).click();
  await bob.getByRole("button", { name: "Enviar Votos" }).click();

  await expect(tv.getByTestId("tv-option-3")).toBeVisible({ timeout: 10_000 });
  await expectDeezerLogo(tv, "rodada");

  for (let r = 0; r < 2; r++) {
    await ana.getByTestId("answer-0").click();
    await bob.getByTestId("answer-1").click();
    await expect(tv.getByText("RESPOSTA CORRETA")).toBeVisible();
    if (r === 0) await expectDeezerLogo(tv, "revelação");
    if (r === 0) await expect(tv.getByTestId("tv-option-0")).toBeVisible({ timeout: 10_000 });
  }

  await expect(tv.getByText("Fim de jogo!")).toBeVisible({ timeout: 10_000 });
  await expectDeezerLogo(tv, "ranking final");

  await Promise.all([tvCtx.close(), aCtx.close(), bCtx.close()]);
});

onTest("logo também em telas pequenas e nos outros idiomas", async ({ browser }) => {
  for (const [locale, vp] of [["en-US", { width: 360, height: 640 }], ["es-ES", { width: 1920, height: 1080 }]] as const) {
    const ctx = await browser.newContext({ locale, viewport: vp });
    const page = await ctx.newPage();
    await page.goto("/");
    await expectDeezerLogo(page, `home ${locale} ${vp.width}px`);
    await page.goto("/play");
    await expectDeezerLogo(page, `entrada ${locale} ${vp.width}px`);
    await ctx.close();
  }
});

// Janelas baixas/estreitas (celular deitado, janela pequena, TV com zoom): o logo não pode ficar
// escondido sob o título nem fora da tela exigindo rolagem.
onTest("logo visível em janelas baixas", async ({ browser }) => {
  for (const vp of [
    { width: 640, height: 360 },
    { width: 568, height: 320 },
    { width: 800, height: 600 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const at = `${vp.width}x${vp.height}`;
    await page.goto("/");
    await expectDeezerLogo(page, `home ${at}`);
    await page.goto("/host");
    await expect(page.getByTestId("room-code")).toBeVisible();
    await expectDeezerLogo(page, `TV ${at}`);
    await ctx.close();
  }
});

// A assinatura "Powered by Deezer" é larga (≈6,8:1): em telas estreitas ela não pode empurrar o
// seletor de idioma para fora da tela nem sobrepô-lo.
onTest("em telas estreitas o logo não esconde nem sobrepõe o seletor de idioma", async ({ browser }) => {
  for (const vp of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 780 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const at = `${vp.width}px`;
    await page.goto("/");
    await expectDeezerLogo(page, `home ${at}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, `home ${at}: rolagem horizontal`).toBeLessThanOrEqual(0);

    const logoBox = (await page.getByTestId("deezer-logo").boundingBox())!;
    for (const name of ["Português (Brasil)", "English", "Español"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box, `home ${at}: botão ${name}`).not.toBeNull();
      expect(box!.x, `home ${at}: ${name} fora da tela (esquerda)`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `home ${at}: ${name} fora da tela (direita)`).toBeLessThanOrEqual(vp.width);
      const overlaps =
        box!.x < logoBox.x + logoBox.width &&
        box!.x + box!.width > logoBox.x &&
        box!.y < logoBox.y + logoBox.height &&
        box!.y + box!.height > logoBox.y;
      expect(overlaps, `home ${at}: ${name} sobreposto ao logo`).toBe(false);
    }

    // título da home inteiro dentro da tela (não cortado nas bordas)
    const h1 = (await page.getByRole("heading", { name: "BEATRUSH" }).boundingBox())!;
    expect(h1.x, `home ${at}: título cortado à esquerda`).toBeGreaterThanOrEqual(0);
    expect(h1.x + h1.width, `home ${at}: título cortado à direita`).toBeLessThanOrEqual(vp.width);

    // entrada do celular: o logo precisa estar visível sem rolar, mesmo em tela pequena
    await page.goto("/play");
    await expectDeezerLogo(page, `entrada do celular ${at}`);
    await ctx.close();
  }
});

// Plano B: sem o arquivo do logo (clone do repositório, arquivo removido), nada de imagem quebrada.
onTest("sem o arquivo do logo mostra o texto Powered by Deezer, sem imagem quebrada", async ({ page }) => {
  await page.route("**/brand/deezer/**", (route) => route.abort());
  await page.goto("/");
  const logo = page.getByTestId("deezer-logo");
  await expect(logo).toHaveText("Powered by Deezer");
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((el) => el.tagName)).toBe("SPAN");
  await expect(page.locator("img[src*=\"brand/deezer\"]")).toHaveCount(0);

  await page.goto("/play");
  await expect(page.getByTestId("deezer-logo")).toHaveText("Powered by Deezer");
  await page.goto("/host");
  await expect(page.getByTestId("room-code")).toBeVisible();
  await expect(page.getByTestId("deezer-logo")).toHaveText("Powered by Deezer");
});

/* =========================== marca DESLIGADA (padrão) =========================== */

offTest("marca desligada: nenhuma tela mostra logo nem 'Powered by Deezer'", async ({ page }) => {
  const ausente = async (where: string) => {
    await expect(page.getByTestId("deezer-logo"), where).toHaveCount(0);
    await expect(page.locator('img[src*="brand/deezer"]'), where).toHaveCount(0);
    await expect(page.getByText(/powered by/i), where).toHaveCount(0);
  };
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Criar Nova Sala" })).toBeVisible();
  await ausente("tela inicial");

  await page.goto("/play");
  await expect(page.getByRole("button", { name: "Entrar no Jogo" })).toBeVisible();
  await ausente("entrada do celular");

  await page.goto("/host");
  await expect(page.getByTestId("room-code")).toBeVisible();
  await ausente("TV (lobby)");

  // o aviso "Sobre" continua informando a origem, sem exibir a marca
  await page.getByRole("button", { name: "Sobre", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("API do Deezer");
  await ausente("TV com o aviso Sobre aberto");
});

offTest("marca desligada: nem o arquivo do logo é pedido ao servidor", async ({ page }) => {
  const pedidos: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/brand/deezer")) pedidos.push(r.url());
  });
  for (const url of ["/", "/play", "/host"]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
  }
  expect(pedidos, "o arquivo do logo não deveria ser baixado").toEqual([]);
});

offTest("marca desligada: o layout continua bom sem o logo (idioma, Sobre e controles alcançáveis)", async ({ browser }) => {
  const dentro = async (page: import("@playwright/test").Page, name: string | RegExp, at: string, vp: { width: number; height: number }) => {
    const box = await page.getByRole("button", { name }).first().boundingBox();
    expect(box, `${at}: botão ${String(name)} ausente`).not.toBeNull();
    expect(box!.x, `${at}: ${String(name)} fora (esquerda)`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${at}: ${String(name)} fora (direita)`).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height, `${at}: ${String(name)} fora (embaixo)`).toBeLessThanOrEqual(vp.height);
  };

  for (const vp of [
    { width: 320, height: 568 },
    { width: 390, height: 780 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const at = `celular ${vp.width}px`;
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `home ${at}: rolagem horizontal`).toBeLessThanOrEqual(0);
    for (const n of ["Português (Brasil)", "English", "Español"]) await dentro(page, n, `home ${at}`, vp);
    const h1 = (await page.getByRole("heading", { name: "BEATRUSH" }).boundingBox())!;
    expect(h1.x, `home ${at}: título cortado`).toBeGreaterThanOrEqual(0);
    expect(h1.x + h1.width, `home ${at}: título cortado`).toBeLessThanOrEqual(vp.width);

    await page.goto("/play");
    await dentro(page, "English", `entrada ${at}`, { width: vp.width, height: 100000 }); // a página pode rolar na vertical
    await ctx.close();
  }

  for (const vp of [
    { width: 568, height: 320 },
    { width: 800, height: 600 },
    { width: 1280, height: 720 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const at = `TV ${vp.width}x${vp.height}`;
    await page.goto("/host");
    await expect(page.getByTestId("room-code")).toBeVisible();
    for (const n of [/^Sobre$/, "English", /^Som: (ON|OFF)$/]) await dentro(page, n, at, vp); // rodapé fixo na base
    await ctx.close();
  }
});
