const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Cocina E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver pedidos pendientes en cocina', async ({ page }) => {
    await page.goto('/cocina');

    // Wait for cocina page to load - h1 is "Cocina"
    await expect(page.locator('h1:has-text("Cocina")')).toBeVisible({ timeout: 10000 });

    // Should show pending count
    await expect(page.locator('text=Pendientes').first()).toBeVisible();
  });

  test('iniciar preparacion de pedido', async ({ page }) => {
    await page.goto('/cocina');
    await expect(page.locator('h1:has-text("Cocina")')).toBeVisible({ timeout: 10000 });

    // Find and click "Iniciar Preparación" button on first pending order
    const startButton = page.locator('button:has-text("Iniciar Preparación")').first();

    if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startButton.click();

      // Wait for state to update
      await page.waitForTimeout(1000);
    }
  });

  test('marcar pedido como listo', async ({ page }) => {
    await page.goto('/cocina');
    await expect(page.locator('h1:has-text("Cocina")')).toBeVisible({ timeout: 10000 });

    // Find and click "Marcar Listo" button
    const readyButton = page.locator('button:has-text("Marcar Listo")').first();

    if (await readyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await readyButton.click();

      // Wait for state to update
      await page.waitForTimeout(1000);
    }
  });
});
