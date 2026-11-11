import { expect, test } from "@playwright/test";

test("primeira visita segue o idioma do navegador", async ({ browser }) => {
  for (const [locale, text] of [
    ["en-US", "Create New Room"],
    ["es-ES", "Crear Nueva Sala"],
    ["pt-BR", "Criar Nova Sala"],
    ["fr-FR", "Criar Nova Sala"], // não suportado → padrão do produto
  ] as const) {
    const ctx = await browser.newContext({ locale });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.getByRole("link", { name: text })).toBeVisible();
    await ctx.close();
  }
});

test("trocar o idioma na home persiste após recarregar e atualiza <html lang>", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("link", { name: "Create New Room" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.reload();
  await expect(page.getByRole("link", { name: "Create New Room" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "Español" }).click();
  await expect(page.getByRole("link", { name: "Crear Nueva Sala" })).toBeVisible();
});

test("TV em inglês e celulares em idiomas diferentes jogam juntos", async ({ browser }) => {
  const tvCtx = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 720 } });
  const esCtx = await browser.newContext({ locale: "es-ES", viewport: { width: 390, height: 780 } });
  const ptCtx = await browser.newContext({ locale: "pt-BR", viewport: { width: 390, height: 780 } });
  const tv = await tvCtx.newPage();
  const es = await esCtx.newPage();
  const pt = await ptCtx.newPage();

  await tv.goto("/host");
  const code = (await tv.getByTestId("room-code").textContent())!;
  await expect(tv.getByText("ROOM CODE")).toBeVisible();

  await es.goto(`/play?code=${code}`);
  await es.getByPlaceholder("¿Cómo te llaman?").fill("Eva");
  await es.getByRole("button", { name: "Entrar al Juego" }).click();
  await expect(es.getByText("¡Ya estás dentro!")).toBeVisible();

  await pt.goto(`/play?code=${code}`);
  await pt.getByPlaceholder("Como te chamam?").fill("Beto");
  await pt.getByRole("button", { name: "Entrar no Jogo" }).click();
  await expect(pt.getByText("Você está dentro!")).toBeVisible();

  // a TV (inglês) mostra os dois; Eva é a anfitriã
  await expect(tv.getByText("2 / 8 connected")).toBeVisible();
  await expect(tv.getByText("Eva (Host)")).toBeVisible();

  // começa a votação: cada aparelho mostra os gêneros no seu idioma
  await es.getByRole("button", { name: "Iniciar Selección de Géneros" }).click();
  await expect(tv.getByText("What's the vibe?")).toBeVisible();
  await expect(es.getByRole("button", { name: "Años 80" })).toBeVisible();
  await expect(pt.getByRole("button", { name: "Anos 80" })).toBeVisible();

  // o voto usa o id interno do gênero: Eva (es) e Beto (pt) votam "Años 80"/"Anos 80" → mesmo gênero
  await es.getByRole("button", { name: "Años 80" }).click();
  await es.getByRole("button", { name: "Enviar Votos" }).click();
  await pt.getByRole("button", { name: "Anos 80" }).click();
  await pt.getByRole("button", { name: "Enviar Votos" }).click();

  await expect(tv.getByText("What's the song?")).toBeVisible({ timeout: 10_000 });
  await expect(es.getByRole("status").last()).toContainText("Toca la figura");
  await expect(pt.getByRole("status").last()).toContainText("Toque na forma");

  await Promise.all([tvCtx.close(), esCtx.close(), ptCtx.close()]);
});

test("erro de entrada é traduzido e acompanha o idioma do aparelho", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto("/play?code=ZZZZ");
  await page.getByPlaceholder("What do they call you?").fill("Solo");
  await page.getByRole("button", { name: "Join Game" }).click();
  await expect(page.getByText("Room not found. Check the code.")).toBeVisible();
  await ctx.close();
});
