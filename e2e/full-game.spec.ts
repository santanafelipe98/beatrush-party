import { expect, test, type Page } from "@playwright/test";

async function joinAs(page: Page, code: string, name: string) {
  await page.goto(`/play?code=${code}`);
  await page.getByPlaceholder("Como te chamam?").fill(name);
  await page.getByRole("button", { name: "Entrar no Jogo" }).click();
  await expect(page.getByText("Você está dentro!")).toBeVisible();
}

test("partida completa: TV + 2 celulares, do lobby à revanche", async ({ browser }) => {
  const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const aCtx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const bCtx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const tv = await tvCtx.newPage();
  const ana = await aCtx.newPage();
  const bob = await bCtx.newPage();

  // Menu → cria sala
  await tv.goto("/");
  await tv.getByRole("link", { name: "Criar Nova Sala" }).click();
  const code = (await tv.getByTestId("room-code").textContent())!;
  expect(code).toMatch(/^[A-Z]{4}$/);

  // Jogadores entram (Ana é a primeira ⇒ host)
  await joinAs(ana, code, "Ana");
  await joinAs(bob, code, "Bob");
  await expect(tv.getByText("2 / 8 conectados")).toBeVisible();
  await expect(tv.getByText("Ana (Host)")).toBeVisible();

  // Só o host vê o botão de iniciar
  await expect(bob.getByRole("button", { name: "Iniciar Seleção de Gêneros" })).toHaveCount(0);
  await ana.getByRole("button", { name: "Iniciar Seleção de Gêneros" }).click();

  // Votação de gêneros (todos votam ⇒ encerra antecipado)
  await expect(tv.getByText("Qual vai ser a vibe?")).toBeVisible();
  await ana.getByRole("button", { name: "Pop" }).click();
  await ana.getByRole("button", { name: "Funk" }).click();
  await ana.getByRole("button", { name: "Enviar Votos" }).click();
  await bob.getByRole("button", { name: "Pop" }).click();
  await bob.getByRole("button", { name: "Enviar Votos" }).click();

  for (let round = 1; round <= 2; round++) {
    // Rodada: 4 opções na TV, formas no celular
    await expect(tv.getByText(`Música ${round}`)).toBeVisible({ timeout: 10_000 });
    await expect(tv.getByTestId("tv-option-3")).toBeVisible();
    await ana.getByTestId("answer-0").click();
    await expect(ana.getByText("Resposta enviada")).toBeVisible();
    await bob.getByTestId("answer-1").click();

    // Todos responderam ⇒ revelação
    await expect(tv.getByText("RESPOSTA CORRETA")).toBeVisible();
    await expect(tv.getByTestId("reveal-title")).not.toBeEmpty();
    await expect(ana.getByRole("status").last()).toContainText(/Acertou|Errou/);
  }

  // Fim de jogo
  await expect(tv.getByText("Fim de jogo!")).toBeVisible({ timeout: 10_000 });
  await expect(tv.getByTestId("ranking-row")).toHaveCount(2);
  await expect(ana.getByTestId("my-place")).toBeVisible();
  await expect(bob.getByTestId("my-place")).toBeVisible();

  // Revanche por maioria volta ao lobby com placar zerado
  await ana.getByRole("button", { name: "Votar para Jogar de Novo" }).click();
  await bob.getByRole("button", { name: "Votar para Jogar de Novo" }).click();
  await expect(tv.getByTestId("room-code")).toHaveText(code);
  await expect(ana.getByText("Você está dentro!")).toBeVisible();

  await Promise.all([tvCtx.close(), aCtx.close(), bCtx.close()]);
});

test("código inexistente volta ao formulário com erro", async ({ page }) => {
  await page.goto("/play?code=ZZZZ");
  await page.getByPlaceholder("Como te chamam?").fill("Solo");
  await page.getByRole("button", { name: "Entrar no Jogo" }).click();
  await expect(page.getByText("Sala não encontrada. Confira o código.")).toBeVisible();
});

test("reconexão: celular recarregado volta para a sala", async ({ browser }) => {
  const tvCtx = await browser.newContext();
  const pCtx = await browser.newContext();
  const tv = await tvCtx.newPage();
  const phone = await pCtx.newPage();
  await tv.goto("/host");
  const code = (await tv.getByTestId("room-code").textContent())!;
  await joinAs(phone, code, "Zé");
  await expect(tv.getByText("Zé (Host)")).toBeVisible();

  // TV recarrega: reanexa à mesma sala (sessionStorage)
  await tv.reload();
  await expect(tv.getByTestId("room-code")).toHaveText(code);
  await expect(tv.getByText("Zé (Host)")).toBeVisible();
  await Promise.all([tvCtx.close(), pCtx.close()]);
});
