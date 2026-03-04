const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Productos E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver listado de productos', async ({ page }) => {
    await page.goto('/productos');
    await expect(page.locator('h1:has-text("Productos")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testData.productName}`)).toBeVisible();
  });

  test('crear nuevo producto', async ({ page }) => {
    await page.goto('/productos');
    await expect(page.locator('h1:has-text("Productos")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nuevo Producto")');

    // Fill form
    await page.fill('#producto-nombre', 'E2E Pizza Test');
    await page.fill('#producto-precio', '7500');
    await page.selectOption('#producto-categoria', { label: testData.categoryName });

    // Submit
    await page.click('button:has-text("Crear")');

    // Verify
    await expect(page.locator('text=E2E Pizza Test')).toBeVisible({ timeout: 5000 });
  });

  test('editar producto', async ({ page }) => {
    await page.goto('/productos');
    await expect(page.locator(`text=${testData.productName}`)).toBeVisible({ timeout: 10000 });

    await page.click(`button[aria-label="Editar producto: ${testData.productName}"]`);

    // Change price
    await page.fill('#producto-precio', '6000');

    // Submit
    await page.click('button:has-text("Guardar")');

    // Verify price change
    await expect(page.locator('text=$6.000')).toBeVisible({ timeout: 5000 });
  });

  test('toggle disponibilidad de producto', async ({ page }) => {
    await page.goto('/productos');
    await expect(page.locator(`text=${testData.productName}`)).toBeVisible({ timeout: 10000 });

    // Find the availability toggle for E2E product
    const productRow = page.locator('tr, div').filter({ hasText: testData.productName }).first();
    const badge = productRow.locator('.badge').first();

    // Click the toggle/badge
    await badge.click();

    // Wait for state change
    await page.waitForTimeout(1000);

    // Toggle back to restore original state
    await badge.click();
  });
});
