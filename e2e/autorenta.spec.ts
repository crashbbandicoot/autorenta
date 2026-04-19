import { test, expect } from "@playwright/test";
import path from "path";

const ZIP_PATH = path.resolve(__dirname, "../test_data/inputs/renta_2026.zip");

// Uploads the ZIP then navigates via SPA clicks (keeps rawContent in React context)
async function uploadAndGoTo(page: import("@playwright/test").Page, href: string) {
  await page.goto("/subir-extractos");
  await page.locator('input[type="file"]').setInputFiles(ZIP_PATH);
  await expect(page.getByText(/ZIP válido/)).toBeVisible({ timeout: 10000 });

  // Click the top "Informe" nav link — /informe redirects to /informe/dividendos
  await page.locator('nav a[href="/informe"]').click();
  await page.waitForURL("**/informe/dividendos");

  // Navigate to the specific sub-tab if needed
  if (href !== "/informe/dividendos") {
    await page.locator(`a[href="${href}"]`).click();
    await page.waitForURL(`**${href}`);
  }
}

test.describe("Navegación principal", () => {
  test("redirige / a /obtener-extractos", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/obtener-extractos/);
  });

  test("todas las secciones del nav son accesibles", async ({ page }) => {
    await page.goto("/obtener-extractos");
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "Obtener extractos", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Subir extractos", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Informe", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Instrucciones Renta", exact: true })).toBeVisible();
  });

  test("página Obtener Extractos muestra título correcto", async ({ page }) => {
    await page.goto("/obtener-extractos");
    await expect(page.getByRole("heading", { name: /descargar tus extractos/i })).toBeVisible();
  });

  test("página Instrucciones Renta muestra título correcto", async ({ page }) => {
    await page.goto("/instrucciones-renta");
    await expect(page.getByRole("heading", { name: /declarar en la Renta/i })).toBeVisible();
  });
});

test.describe("Subir extractos — upload y validación", () => {
  test("muestra dropzone al entrar en /subir-extractos", async ({ page }) => {
    await page.goto("/subir-extractos");
    await expect(page.getByText(/Arrastra tu \.zip/i)).toBeVisible();
  });

  test("sube ZIP válido y muestra estado OK", async ({ page }) => {
    await page.goto("/subir-extractos");
    await page.locator('input[type="file"]').setInputFiles(ZIP_PATH);
    await expect(page.getByText(/ZIP válido/)).toBeVisible({ timeout: 10000 });
  });

  test("muestra el número de archivos CSV detectados (8 en el ZIP de test)", async ({ page }) => {
    await page.goto("/subir-extractos");
    await page.locator('input[type="file"]').setInputFiles(ZIP_PATH);
    await expect(page.getByText(/8 archivos encontrados/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Informe — pestañas (requiere ZIP cargado en sesión)", () => {
  test("pestaña Dividendos muestra 150 filas con valores reales", async ({ page }) => {
    await uploadAndGoTo(page, "/informe/dividendos");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    expect(await rows.count()).toBe(150);

    // Primera celda de la primera fila no debe ser guión
    const firstCells = rows.first().locator("td");
    const texts = await firstCells.allInnerTexts();
    expect(texts.filter((t) => t.trim() !== "—" && t.trim() !== "").length).toBeGreaterThan(3);
  });

  test("pestaña Transacciones muestra 347 filas con valores reales", async ({ page }) => {
    await uploadAndGoTo(page, "/informe/dividendos");
    await page.getByRole("link", { name: "Histórico de Transacciones", exact: true }).click();
    await page.waitForURL("**/informe/transacciones");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    expect(await rows.count()).toBe(347);
  });

  test("pestaña PyG muestra filas con P&L", async ({ page }) => {
    await uploadAndGoTo(page, "/informe/dividendos");
    await page.getByRole("link", { name: "Informe de PyG", exact: true }).click();
    await page.waitForURL("**/informe/pyg");
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 8000 });
    expect(await rows.count()).toBeGreaterThan(100);
  });

  test("botón Descargar Excel está habilitado en Dividendos", async ({ page }) => {
    await uploadAndGoTo(page, "/informe/dividendos");
    const btn = page.getByRole("button", { name: /excel|descargar/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("botón Descargar Excel está habilitado en Transacciones", async ({ page }) => {
    await uploadAndGoTo(page, "/informe/transacciones");
    const btn = page.getByRole("button", { name: /excel|descargar/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("botón Descargar Excel está habilitado en PyG", async ({ page }) => {
    await uploadAndGoTo(page, "/informe/pyg");
    const btn = page.getByRole("button", { name: /excel|descargar/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });
});

test.describe("Informe sin datos — estado vacío", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/subir-extractos");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("Dividendos sin datos muestra mensaje de estado vacío", async ({ page }) => {
    await page.goto("/informe/dividendos");
    await expect(page.locator("main").getByText("No hay datos disponibles")).toBeVisible({ timeout: 5000 });
  });

  test("Transacciones sin datos muestra mensaje de estado vacío", async ({ page }) => {
    await page.goto("/informe/transacciones");
    await expect(page.locator("main").getByText("No hay datos disponibles")).toBeVisible({ timeout: 5000 });
  });

  test("PyG sin datos muestra mensaje de estado vacío", async ({ page }) => {
    await page.goto("/informe/pyg");
    await expect(page.locator("main").getByText("No hay datos disponibles")).toBeVisible({ timeout: 5000 });
  });
});
