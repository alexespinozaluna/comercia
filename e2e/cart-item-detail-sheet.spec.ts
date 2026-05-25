import { test, expect } from "@playwright/test";

// Regresión del bug: los campos Cantidad/Precio se reseteaban al cambiar de
// foco entre ellos, y no había confirmación con Enter. La edición ahora vive
// en estado local y solo se vuelca al padre al confirmar (Enter / "Actualizar").
test.describe("CartItemDetailSheet", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev-harness/cart-item");
  });

  test("no resetea cantidad/precio al cambiar de foco y confirma con Enter", async ({ page }) => {
    const qty = page.locator('input[type="number"]');
    const price = page.locator('input[inputmode="decimal"]');
    const committed = page.getByTestId("committed");

    await expect(committed).toHaveText("qty=3;price=1250.75");

    // Escribir cantidad y mover foco a precio → la cantidad NO debe resetearse.
    await qty.click();
    await qty.pressSequentially("7");
    await price.click();
    await expect(qty).toHaveValue("7");

    // Escribir precio y volver el foco a cantidad → el precio NO debe resetearse.
    await price.fill("");
    await price.pressSequentially("2000");
    await qty.click();
    await expect(price).toHaveValue("2000");

    // El padre NO debe estar commiteado todavía (solo se confirma al submit).
    await expect(committed).toHaveText("qty=3;price=1250.75");

    // Enter confirma: vuelca al padre y cierra el sheet.
    await qty.press("Enter");
    await expect(committed).toHaveText("qty=7;price=2000");
    await expect(qty).toHaveCount(0);
  });

  test("los botones +/- editan estado local sin tocar al padre", async ({ page }) => {
    const qty = page.locator('input[type="number"]');
    const committed = page.getByTestId("committed");
    const plus = page.locator("button:has(svg.lucide-plus)");
    const minus = page.locator("button:has(svg.lucide-minus)");

    await plus.click();
    await expect(qty).toHaveValue("4");
    await minus.click();
    await expect(qty).toHaveValue("3");

    // El padre permanece intacto hasta confirmar.
    await expect(committed).toHaveText("qty=3;price=1250.75");
  });

  test("el subtotal es reactivo mientras se edita, sin confirmar", async ({ page }) => {
    const qty = page.locator('input[type="number"]');
    const committed = page.getByTestId("committed");

    // 5 × 1250,75 = 6.253,75
    await qty.click();
    await qty.pressSequentially("5");
    await expect(page.getByText("$ 6.253,75")).toBeVisible();

    // El subtotal reactivo no implica commit al padre.
    await expect(committed).toHaveText("qty=3;price=1250.75");
  });
});
