import { expect, test } from "@playwright/test";

// Regressão: @keyframes dentro de @theme (Tailwind v4) são descartados se nenhuma classe
// animate-* os referenciar, e o equalizador (animação inline) ficava parado.
test("equalizador e título da home estão animados", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName));
  expect(names.filter((n) => n === "eq").length).toBeGreaterThanOrEqual(40);
  expect(names).toContain("pulse-beat");
});
