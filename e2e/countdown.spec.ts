import { expect, test, type Browser } from "@playwright/test";

/**
 * Contagem 3-2-1 antes de cada música. O servidor de teste usa COUNTDOWN_MS=1500 (0,5 s por número);
 * em produção o padrão é 3000 ms (1 s por número).
 */
const COUNTDOWN_MS = 1500;

async function setup(browser: Browser) {
  const tvCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const aCtx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const bCtx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const tv = await tvCtx.newPage();
  const ana = await aCtx.newPage();
  const bob = await bCtx.newPage();

  // registra cada número que a TV exibe, com o horário, e quando as opções aparecem
  await tv.addInitScript(() => {
    const w = window as unknown as { __log: { t: number; ev: string }[] };
    w.__log = [];
    new MutationObserver(() => {
      const c = document.querySelector('[data-testid="tv-countdown"]');
      const step = c?.getAttribute("data-step");
      const last = [...w.__log].reverse().find((e) => e.ev.startsWith("step:"));
      if (step && last?.ev !== `step:${step}`) w.__log.push({ t: performance.now(), ev: `step:${step}` });
      if (document.querySelector('[data-testid="tv-option-0"]') && !w.__log.some((e) => e.ev === "options"))
        w.__log.push({ t: performance.now(), ev: "options" });
    }).observe(document, { childList: true, subtree: true, attributes: true });
  });

  await tv.goto("/host");
  const code = (await tv.getByTestId("room-code").textContent())!;
  for (const [p, name] of [[ana, "Ana"], [bob, "Bob"]] as const) {
    await p.goto(`/play?code=${code}`);
    await p.getByPlaceholder("Como te chamam?").fill(name);
    await p.getByRole("button", { name: "Entrar no Jogo" }).click();
  }
  await ana.getByRole("button", { name: "Iniciar Seleção de Gêneros" }).click();
  await ana.getByRole("button", { name: "Pop" }).click();
  await ana.getByRole("button", { name: "Confirmar Gênero" }).click();
  await bob.getByRole("button", { name: "Pop" }).click();
  await bob.getByRole("button", { name: "Confirmar Gênero" }).click();
  return { tv, ana, bob, close: () => Promise.all([tvCtx.close(), aCtx.close(), bCtx.close()]) };
}

test("a TV conta 3, 2, 1 e só depois mostra a pergunta e as opções", async ({ browser }) => {
  const { tv, close } = await setup(browser);

  await expect(tv.getByTestId("tv-countdown")).toBeVisible({ timeout: 10_000 });
  await expect(tv.getByText("Prepare-se!")).toBeVisible();
  await expect(tv.getByTestId("tv-option-0")).toHaveCount(0); // nada de opções durante a contagem
  await expect(tv.getByText("Qual é a música?")).toHaveCount(0);

  await expect(tv.getByTestId("tv-option-3")).toBeVisible({ timeout: 10_000 });
  await expect(tv.getByTestId("tv-countdown")).toHaveCount(0);

  const log = await tv.evaluate(() => (window as unknown as { __log: { t: number; ev: string }[] }).__log);
  const steps = log.filter((e) => e.ev.startsWith("step:")).map((e) => e.ev.slice(5));
  expect(steps.slice(0, 3), `sequência observada: ${steps.join(",")}`).toEqual(["3", "2", "1"]);

  // do primeiro número ("3") até as opções passa ≈ a duração da contagem
  const first = log.find((e) => e.ev === "step:3")!;
  const options = log.find((e) => e.ev === "options")!;
  const elapsed = options.t - first.t;
  expect(elapsed, `contagem durou ${Math.round(elapsed)} ms`).toBeGreaterThan(COUNTDOWN_MS - 400);
  expect(elapsed, `contagem durou ${Math.round(elapsed)} ms`).toBeLessThan(COUNTDOWN_MS + 900);
  await close();
});

test("no celular os botões ficam travados na contagem e liberam no 'valendo'", async ({ browser }) => {
  const { tv, ana, close } = await setup(browser);

  await expect(ana.getByTestId("pad-countdown")).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 4; i++) await expect(ana.getByTestId(`answer-${i}`)).toBeDisabled();
  await expect(ana.getByText("As respostas abrem quando a música começar")).toBeVisible();

  // o "valendo" chega: contagem some e os botões liberam
  await expect(ana.getByTestId("pad-countdown")).toHaveCount(0, { timeout: 5000 });
  for (let i = 0; i < 4; i++) await expect(ana.getByTestId(`answer-${i}`)).toBeEnabled();

  await ana.getByTestId("answer-0").click();
  await expect(ana.getByText("Resposta enviada")).toBeVisible();
  await expect(tv.getByTestId("tv-option-0")).toBeVisible();
  await close();
});

test("a contagem acontece em TODAS as rodadas, não só na primeira", async ({ browser }) => {
  const { tv, ana, bob, close } = await setup(browser);

  await expect(tv.getByTestId("tv-option-0")).toBeVisible({ timeout: 10_000 }); // rodada 1 valendo
  await ana.getByTestId("answer-0").click();
  await bob.getByTestId("answer-1").click();
  await expect(tv.getByText("RESPOSTA CORRETA")).toBeVisible();

  // revelação → rodada 2: contagem de novo
  await expect(tv.getByTestId("tv-countdown")).toBeVisible({ timeout: 10_000 });
  await expect(tv.getByText("Música 2")).toBeVisible();
  await expect(ana.getByTestId("pad-countdown")).toBeVisible();
  await expect(ana.getByTestId("answer-0")).toBeDisabled();
  await expect(tv.getByTestId("tv-option-0")).toBeVisible({ timeout: 10_000 });
  await expect(ana.getByTestId("answer-0")).toBeEnabled();
  await close();
});
