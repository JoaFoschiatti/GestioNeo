const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Dashboard E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('muestra estadisticas principales', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ventas de Hoy')).toBeVisible();
    await expect(page.locator('text=Pedidos Hoy')).toBeVisible();
    await expect(page.locator('text=Mesas Ocupadas')).toBeVisible();
  });

  test('muestra accesos rapidos', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });
    // Use main area to avoid matching sidebar links
    const main = page.locator('main');
    await expect(main.locator('text=Nuevo Pedido')).toBeVisible();
    await expect(main.locator('text=Ver Mesas')).toBeVisible();
    await expect(main.locator('text=Cocina').first()).toBeVisible();
    await expect(main.locator('text=Reportes').first()).toBeVisible();
  });

  test('acceso rapido Nuevo Pedido navega correctamente', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });
    await page.locator('main a:has-text("Nuevo Pedido")').first().click();
    await expect(page).toHaveURL(/\/mozo\/nuevo-pedido/, { timeout: 5000 });
  });
});
