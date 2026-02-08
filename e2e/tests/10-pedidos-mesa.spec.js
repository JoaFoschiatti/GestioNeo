const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Pedidos Mesa E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('crear pedido en mesa', async ({ page }) => {
    // Navigate to new order for E2E table
    await page.goto(`/mozo/nuevo-pedido/${testData.tableId}`);

    // Wait for categories to load, then click E2E category tab
    await expect(page.locator(`button:has-text("${testData.categoryName}")`)).toBeVisible({ timeout: 10000 });
    await page.click(`button:has-text("${testData.categoryName}")`);

    // Wait for E2E product to appear
    await expect(page.locator(`button:has-text("${testData.productName}")`)).toBeVisible({ timeout: 5000 });

    // Click on product to add to cart (triggers async modifier check + add)
    await page.click(`button:has-text("${testData.productName}")`);

    // Handle modifiers dialog if it appears (product may have linked modifiers)
    const sinModificar = page.locator('button:has-text("Sin modificar")');
    if (await sinModificar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sinModificar.click();
    }

    // Wait for "Confirmar Pedido" button to be enabled (product was added to cart)
    const confirmBtn = page.locator('[data-testid="order-confirm-submit"]');
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
    await confirmBtn.click();

    // Should see success message with order number (use .first() to avoid strict mode)
    await expect(page.locator('text=/Pedido #\\d+/').first()).toBeVisible({ timeout: 10000 });
  });

  test('ver pedido creado en lista de pedidos', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page.locator('h1:has-text("Pedidos")')).toBeVisible({ timeout: 10000 });

    // Should see at least one order - check for order ID pattern
    await expect(page.locator('text=/#\\d+/').first()).toBeVisible({ timeout: 5000 });
  });

  test('ver detalle de pedido', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page.locator('h1:has-text("Pedidos")')).toBeVisible({ timeout: 10000 });

    // Wait for orders to load
    await expect(page.locator('text=/#\\d+/').first()).toBeVisible({ timeout: 10000 });

    // Click on first order detail button
    const detailButton = page.locator('button[aria-label^="Ver detalle del pedido"]').first();
    await expect(detailButton).toBeVisible({ timeout: 5000 });
    await detailButton.click();

    // Verify modal opens with order info
    await expect(page.locator('text=/Pedido #\\d+/')).toBeVisible({ timeout: 5000 });

    // Close modal (use exact text to avoid matching "Cerrar sesión")
    await page.locator('main button:has-text("Cerrar")').click();
  });
});
