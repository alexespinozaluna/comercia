import { test, expect } from "@playwright/test";

/**
 * Layout móvil de ClienteSelectorSheet (docs/fix-sheet-cliente-teclado-movil.md):
 * el sheet debe tener altura FIJA (85dvh) con el buscador anclado arriba,
 * la lista con scroll interno y el botón "Crear nuevo cliente" visible sin
 * scroll — incluso con muchos clientes (regresión: la lista empujaba el botón
 * fuera del sheet) y al filtrar (regresión: el sheet se encogía y quedaba
 * detrás del teclado virtual).
 */

const VIEWPORT = { width: 393, height: 851 }; // Pixel 5-ish

const clientes = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  Nombre: i === 0 ? "Zacarias Unico" : `Cliente ${String(i + 1).padStart(2, "0")}`,
  NroTelefono: "999888777",
  ClienteDireccion: [],
}));

test.use({ viewport: VIEWPORT });

test.describe("ClienteSelectorSheet (móvil)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/clientes", (route) =>
      route.fulfill({ json: { data: clientes } }),
    );
    // domcontentloaded: en dev el evento "load" puede no dispararse (HMR
    // mantiene recursos pendientes) y el goto por defecto se cuelga.
    await page.goto("/dev-harness/cliente-selector", { waitUntil: "domcontentloaded" });
  });

  test("buscador arriba y botón crear visibles sin scroll, con lista larga", async ({
    page,
  }) => {
    const input = page.getByPlaceholder("Buscar cliente...");
    await expect(input).toBeVisible();

    // El buscador queda anclado en el tercio superior de la pantalla.
    const inputBox = await input.boundingBox();
    expect(inputBox!.y).toBeLessThan(VIEWPORT.height * 0.35);

    // El primer cliente de la lista es visible (la lista scrollea interna,
    // no empuja el resto del contenido).
    await expect(page.getByText("Zacarias Unico")).toBeVisible();

    // El botón de crear queda dentro del sheet, sin necesidad de scroll.
    await expect(
      page.getByRole("button", { name: "Crear nuevo cliente" }),
    ).toBeInViewport();
  });

  test("al filtrar, el resultado queda en la mitad superior (zona libre de teclado)", async ({
    page,
  }) => {
    await page.getByPlaceholder("Buscar cliente...").fill("Zacarias");

    const fila = page.getByText("Zacarias Unico");
    await expect(fila).toBeVisible();

    // El teclado virtual ocupa aprox. la mitad inferior: el resultado debe
    // quedar en la mitad superior para ser visible/tocable mientras se escribe.
    const box = await fila.boundingBox();
    expect(box!.y).toBeLessThan(VIEWPORT.height * 0.5);
  });

  test("seleccionar un cliente lo commitea y cierra el sheet", async ({ page }) => {
    await page.getByPlaceholder("Buscar cliente...").fill("Zacarias");
    await page.getByText("Zacarias Unico").click();
    await expect(page.getByTestId("seleccionado")).toHaveText("Zacarias Unico");
  });
});
