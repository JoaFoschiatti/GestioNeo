const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Ingredientes E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver listado de ingredientes', async ({ page }) => {
    await page.goto('/ingredientes');
    await expect(page.locator('h1:has-text("Ingredientes")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testData.ingredienteName}`)).toBeVisible();
  });

  test('crear ingrediente', async ({ page }) => {
    await page.goto('/ingredientes');
    await expect(page.locator('h1:has-text("Ingredientes")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nuevo Ingrediente")');

    // Fill form
    await page.fill('#ingrediente-nombre', 'E2E Tomate');
    await page.fill('#ingrediente-unidad', 'kg');
    await page.fill('#ingrediente-stock-actual', '25');
    await page.fill('#ingrediente-stock-minimo', '5');
    await page.fill('#ingrediente-costo', '300');

    // Submit
    await page.click('button:has-text("Crear")');

    // Verify
    await expect(page.locator('text=E2E Tomate')).toBeVisible({ timeout: 5000 });
  });

  test('registrar movimiento ENTRADA de stock', async ({ page }) => {
    await page.goto('/ingredientes');
    await expect(page.locator(`text=${testData.ingredienteName}`)).toBeVisible({ timeout: 10000 });

    // Click stock movement button
    await page.click(`button[aria-label="Movimiento de stock: ${testData.ingredienteName}"]`);

    // Fill movement form
    await page.selectOption('#ingrediente-mov-tipo', 'ENTRADA');
    await page.fill('#ingrediente-mov-cantidad', '20');
    await page.fill('#ingrediente-mov-motivo', 'Compra E2E test');

    // Submit
    await page.click('button:has-text("Registrar")');

    // Verify stock increased (was 50, now 70)
    await expect(page.locator('text=70')).toBeVisible({ timeout: 5000 });
  });

  test('registrar movimiento SALIDA de stock', async ({ page }) => {
    await page.goto('/ingredientes');
    await expect(page.locator(`text=${testData.ingredienteName}`)).toBeVisible({ timeout: 10000 });

    // Click stock movement button
    await page.click(`button[aria-label="Movimiento de stock: ${testData.ingredienteName}"]`);

    // Fill movement form
    await page.selectOption('#ingrediente-mov-tipo', 'SALIDA');
    await page.fill('#ingrediente-mov-cantidad', '5');
    await page.fill('#ingrediente-mov-motivo', 'Uso E2E test');

    // Submit
    await page.click('button:has-text("Registrar")');

    // Verify stock decreased (was 70, now 65)
    await expect(page.locator('text=65')).toBeVisible({ timeout: 5000 });
  });
});
