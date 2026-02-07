const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Pedidos Delivery E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('crear pedido DELIVERY', async ({ page }) => {
    await page.goto('/mozo/nuevo-pedido');

    // Wait for the page to load
    await expect(page.locator('#pedido-tipo-mozo')).toBeVisible({ timeout: 10000 });

    // Select DELIVERY type
    await page.selectOption('#pedido-tipo-mozo', 'DELIVERY');

    // Fill client data
    await page.fill('#pedido-cliente-nombre', 'E2E Cliente Delivery');
    await page.fill('#pedido-cliente-telefono', '11-8888-0000');
    await page.fill('#pedido-cliente-direccion', 'Av. Test 123');

    // Click E2E category tab
    await expect(page.locator(`button:has-text("${testData.categoryName}")`)).toBeVisible({ timeout: 10000 });
    await page.click(`button:has-text("${testData.categoryName}")`);

    // Wait for E2E product and click
    await expect(page.locator(`button:has-text("${testData.productName}")`)).toBeVisible({ timeout: 5000 });
    await page.click(`button:has-text("${testData.productName}")`);

    // Wait for product in cart
    await page.waitForTimeout(500);

    // Confirm order
    await page.click('button:has-text("Confirmar Pedido")');

    // Should see success
    await expect(page.locator('text=/Pedido #\\d+/')).toBeVisible({ timeout: 10000 });
  });

  test('filtrar pedidos por estado', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page.locator('h1:has-text("Pedidos")')).toBeVisible({ timeout: 10000 });

    // Wait for orders to load
    await expect(page.locator('text=/#\\d+/').first()).toBeVisible({ timeout: 10000 });

    // Filter by PENDIENTE
    await page.selectOption('#pedidos-filtro-estado', 'PENDIENTE');

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Verify filtered orders are visible (use table cell to avoid matching hidden <option>)
    await expect(page.locator('td:has-text("PENDIENTE")').first()).toBeVisible({ timeout: 5000 });
  });
});
