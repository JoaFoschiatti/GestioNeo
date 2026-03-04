const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Configuracion E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver pagina de configuracion', async ({ page }) => {
    await page.goto('/configuracion');
    // H1 is "Configuracion del Negocio"
    await expect(page.locator('h1:has-text("Configuraci")')).toBeVisible({ timeout: 10000 });
  });

  test('pagina muestra secciones de configuracion', async ({ page }) => {
    await page.goto('/configuracion');
    await expect(page.locator('h1:has-text("Configuraci")')).toBeVisible({ timeout: 10000 });

    // Verify main config sections exist (use h2 to avoid matching button text)
    await expect(page.locator('h2:has-text("Datos del Negocio")')).toBeVisible();
    await expect(page.locator('h2:has-text("Estado del Local")')).toBeVisible({ timeout: 5000 });
  });
});
