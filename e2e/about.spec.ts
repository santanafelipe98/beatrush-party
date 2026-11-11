import { expect, test, type Page } from "@playwright/test";

const dialog = (page: Page) => page.getByRole("dialog");

test("home: Sobre abre o aviso, fecha com Esc e devolve o foco ao botão", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Sobre", exact: true });
  await trigger.click();

  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(d).toContainText("não é detentor dos direitos das músicas");
  await expect(d).toContainText("não é fornecedor de conteúdo musical");
  await expect(d).toContainText("apenas consome, por meio da API do Deezer");
  await expect(d).toContainText("fins não comerciais");
  await expect(page.getByRole("button", { name: "Fechar" })).toBeFocused(); // foco vai para dentro

  await page.keyboard.press("Escape");
  await expect(d).toBeHidden();
  await expect(trigger).toBeFocused(); // e volta para quem abriu
});

test("fecha pelo botão e clicando fora do cartão", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sobre", exact: true }).click();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(dialog(page)).toBeHidden();

  await page.getByRole("button", { name: "Sobre", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await page.mouse.click(5, 5); // fundo escurecido
  await expect(dialog(page)).toBeHidden();
});

test("TV: abrir o Sobre não derruba a sala nem muda de página", async ({ page }) => {
  await page.goto("/host");
  const code = (await page.getByTestId("room-code").textContent())!;
  await page.getByRole("button", { name: "Sobre", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText("não é detentor dos direitos");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();

  expect(new URL(page.url()).pathname).toBe("/host");
  await expect(page.getByTestId("room-code")).toHaveText(code);
});

test("TV: o aviso abre durante a partida e o jogo continua por trás", async ({ browser }) => {
  const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const aCtx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const bCtx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const tv = await tvCtx.newPage();
  const ana = await aCtx.newPage();
  const bob = await bCtx.newPage();

  await tv.goto("/host");
  const code = (await tv.getByTestId("room-code").textContent())!;
  for (const [p, name] of [[ana, "Ana"], [bob, "Bob"]] as const) {
    await p.goto(`/play?code=${code}`);
    await p.getByPlaceholder("Como te chamam?").fill(name);
    await p.getByRole("button", { name: "Entrar no Jogo" }).click();
  }
  await ana.getByRole("button", { name: "Iniciar Seleção de Gêneros" }).click();
  await ana.getByRole("button", { name: "Pop" }).click();
  await ana.getByRole("button", { name: "Enviar Votos" }).click();
  await bob.getByRole("button", { name: "Pop" }).click();
  await bob.getByRole("button", { name: "Enviar Votos" }).click();
  await expect(tv.getByTestId("tv-option-3")).toBeVisible({ timeout: 10_000 });

  await tv.getByRole("button", { name: "Sobre", exact: true }).click();
  await expect(dialog(tv)).toBeVisible();
  // responder pelos celulares enquanto o aviso está aberto na TV: o jogo segue
  await ana.getByTestId("answer-0").click();
  await bob.getByTestId("answer-1").click();
  await expect(tv.getByText("RESPOSTA CORRETA")).toBeAttached();
  await tv.keyboard.press("Escape");
  await expect(tv.getByTestId("reveal-title")).toBeVisible();

  await Promise.all([tvCtx.close(), aCtx.close(), bCtx.close()]);
});

test("entrada do celular tem o Sobre", async ({ page }) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "Sobre", exact: true }).click();
  await expect(dialog(page)).toContainText("fins não comerciais");
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(dialog(page)).toBeHidden();
});

test("textos em inglês e espanhol", async ({ browser }) => {
  for (const [locale, open, close, rights, nonCom] of [
    ["en-US", "About", "Close", "does not own the rights to the music", "non-commercial"],
    ["es-ES", "Acerca de", "Cerrar", "no es titular de los derechos", "no comercial"],
  ] as const) {
    const ctx = await browser.newContext({ locale });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: open, exact: true }).click();
    await expect(dialog(page)).toContainText(rights);
    await expect(dialog(page)).toContainText(nonCom);
    await page.getByRole("button", { name: close }).click();
    await expect(dialog(page)).toBeHidden();
    await ctx.close();
  }
});

test("em telas pequenas o aviso cabe na janela e o botão Fechar continua alcançável", async ({ browser }) => {
  for (const vp of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Sobre", exact: true }).click();
    const box = (await dialog(page).boundingBox())!;
    const at = `${vp.width}x${vp.height}`;
    expect(box.x, `${at}: cortado à esquerda`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${at}: cortado à direita`).toBeLessThanOrEqual(vp.width);
    expect(box.y, `${at}: cortado em cima`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${at}: cortado embaixo`).toBeLessThanOrEqual(vp.height);
    // ao abrir, o diálogo começa no TOPO (título visível), não rolado até o botão Fechar
    const title = (await page.getByRole("heading", { name: "Sobre o BeatRush Party" }).boundingBox())!;
    expect(title.y, `${at}: título fora da tela ao abrir`).toBeGreaterThanOrEqual(0);
    expect(title.y + title.height, `${at}: título fora da tela ao abrir`).toBeLessThanOrEqual(vp.height);
    await page.getByRole("button", { name: "Fechar" }).click(); // rola dentro do diálogo, se preciso
    await expect(dialog(page)).toBeHidden();
    await ctx.close();
  }
});
