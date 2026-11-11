import { expect, test, type Page } from "@playwright/test";

/**
 * A API do Deezer exige "a clearly visible Deezer Logo" em todo app que a usa.
 * Aqui conferimos: carregou de verdade (não é imagem quebrada), tem tamanho legível e NÃO está
 * coberto por outro elemento.
 */
async function expectDeezerLogo(page: Page, where: string) {
  const logo = page.getByRole("img", { name: /deezer/i });
  await expect(logo, `logo em ${where}`).toBeVisible();
  const info = await logo.evaluate((el) => {
    const img = el as HTMLImageElement;
    const r = img.getBoundingClientRect();
    // amostra uma grade de pontos sobre TODA a área do logo (não só o centro)
    const points: [number, number][] = [];
    for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95])
      for (const fy of [0.15, 0.5, 0.85]) points.push([r.left + r.width * fx, r.top + r.height * fy]);
    return {
      loaded: img.complete && img.naturalWidth === 714 && img.naturalHeight === 200,
      width: r.width,
      height: r.height,
      ratio: r.width / r.height,
      inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      onTop: points.every(([x, y]) => document.elementFromPoint(x, y) === img),
      opacity: getComputedStyle(img).opacity,
    };
  });
  expect(info.loaded, `${where}: arquivo do logo não carregou`).toBe(true);
  expect(info.height, `${where}: logo pequeno demais`).toBeGreaterThanOrEqual(28);
  expect(info.ratio, `${where}: proporção alterada`).toBeCloseTo(714 / 200, 1);
  expect(info.inViewport, `${where}: logo fora da tela`).toBe(true);
  expect(info.onTop, `${where}: logo coberto por outro elemento`).toBe(true);
  expect(info.opacity).toBe("1");
}

test("logo na tela inicial, na entrada do celular e na TV", async ({ page }) => {
  await page.goto("/");
  await expectDeezerLogo(page, "tela inicial");
  await page.goto("/play");
  await expectDeezerLogo(page, "entrada do celular");
  await page.goto("/host");
  await expect(page.getByTestId("room-code")).toBeVisible();
  await expectDeezerLogo(page, "TV (lobby)");
});

test("logo visível em todas as fases da TV", async ({ browser }) => {
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

test("logo também em telas pequenas e nos outros idiomas", async ({ browser }) => {
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
test("logo visível em janelas baixas", async ({ browser }) => {
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
