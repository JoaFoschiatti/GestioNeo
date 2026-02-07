const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Modificadores E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver listado de modificadores', async ({ page }) => {
    await page.goto('/modificadores');
    await expect(page.locator('h1:has-text("Modificadores")')).toBeVisible({ timeout: 10000 });
    // Verify E2E modifier from setup is visible
    await expect(page.locator(`text=${testData.modificadorName}`)).toBeVisible();
  });

  test('crear modificador ADICION', async ({ page }) => {
    await page.goto('/modificadores');
    await expect(page.locator('h1:has-text("Modificadores")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nuevo Modificador")');

    // Fill form
    await page.selectOption('#modificador-tipo', 'ADICION');
    await page.fill('#modificador-nombre', 'E2E Bacon Extra');
    await page.fill('#modificador-precio', '800');

    // Submit
    await page.click('button:has-text("Crear")');

    // Verify
    await expect(page.locator('text=E2E Bacon Extra')).toBeVisible({ timeout: 5000 });
  });

  test('crear modificador EXCLUSION', async ({ page }) => {
    await page.goto('/modificadores');
    await expect(page.locator('h1:has-text("Modificadores")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nuevo Modificador")');

    // Fill form
    await page.selectOption('#modificador-tipo', 'EXCLUSION');
    await page.fill('#modificador-nombre', 'E2E Sin Cebolla');

    // Submit
    await page.click('button:has-text("Crear")');

    // Verify
    await expect(page.locator('text=E2E Sin Cebolla')).toBeVisible({ timeout: 5000 });
  });
});
