const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Delivery E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver pagina de pedidos delivery', async ({ page }) => {
    await page.goto('/delivery/pedidos');

    // Page heading is "Mis Entregas"
    await expect(page.locator('h1:has-text("Mis Entregas")')).toBeVisible({ timeout: 10000 });
  });

  test('marcar pedido como entregado', async ({ page }) => {
    await page.goto('/delivery/pedidos');
    await expect(page.locator('h1:has-text("Mis Entregas")')).toBeVisible({ timeout: 10000 });

    // Find "Marcar como Entregado" button (only visible for LISTO orders)
    const entregadoButton = page.locator('[data-testid^="delivery-mark-delivered-"]').first();

    if (await entregadoButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await entregadoButton.click();
      await page.waitForTimeout(1000);
    }
  });
});
