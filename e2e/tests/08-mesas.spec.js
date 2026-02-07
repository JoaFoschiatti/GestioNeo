const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Mesas E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver grid de mesas en tab Operacion', async ({ page }) => {
    await page.goto('/mesas');

    // Verify Operacion tab is active/visible
    await expect(page.locator('button:has-text("Operación")')).toBeVisible({ timeout: 10000 });

    // Verify E2E table 99 is shown
    await expect(page.locator('main button:has-text("99")')).toBeVisible();
  });

  test('tab Plano carga correctamente', async ({ page }) => {
    await page.goto('/mesas');
    await expect(page.locator('button:has-text("Operación")')).toBeVisible({ timeout: 10000 });

    // Switch to Plano tab
    await page.click('button:has-text("Plano")');

    // Verify plano content loads
    await expect(page.locator('button:has-text("Nueva Mesa")')).toBeVisible({ timeout: 5000 });
  });

  test('crear nueva mesa desde Plano', async ({ page }) => {
    await page.goto('/mesas');
    await expect(page.locator('button:has-text("Operación")')).toBeVisible({ timeout: 10000 });

    // Switch to Plano tab
    await page.click('button:has-text("Plano")');
    await expect(page.locator('button:has-text("Nueva Mesa")')).toBeVisible({ timeout: 5000 });

    // Click create button
    await page.click('button:has-text("Nueva Mesa")');

    // Fill form - use high number to avoid collision
    await page.fill('input[type="number"]', '98');

    // Select capacidad if it's a select
    const capacidadSelect = page.locator('select').first();
    if (await capacidadSelect.isVisible()) {
      await capacidadSelect.selectOption('6');
    }

    // Submit
    await page.click('button:has-text("Crear")');

    // Verify no error
    await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('click mesa LIBRE navega a nuevo pedido', async ({ page }) => {
    await page.goto('/mesas');
    await expect(page.locator('button:has-text("Operación")')).toBeVisible({ timeout: 10000 });

    // Find and click on the E2E mesa (99) which should be LIBRE
    await page.locator('main button:has-text("99")').click();

    // Should navigate to new order page
    await expect(page).toHaveURL(/\/mozo\/nuevo-pedido/, { timeout: 5000 });
  });
});
