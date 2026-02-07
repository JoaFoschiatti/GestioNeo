const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Reportes E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver pagina de reportes', async ({ page }) => {
    await page.goto('/reportes');

    // Page should load without errors
    await expect(page.locator('h1:has-text("Reportes")')).toBeVisible({ timeout: 10000 });
  });

  test('reportes muestran contenido', async ({ page }) => {
    await page.goto('/reportes');
    await expect(page.locator('h1:has-text("Reportes")')).toBeVisible({ timeout: 10000 });

    // Verify some report sections are visible
    // Look for chart containers, tables, or stat sections
    const sections = page.locator('h2, h3, .card');
    const count = await sections.count();
    expect(count).toBeGreaterThan(0);
  });
});
