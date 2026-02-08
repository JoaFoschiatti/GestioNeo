const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Pedidos Mostrador E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('crear pedido MOSTRADOR desde modal', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page.locator('h1:has-text("Pedidos")')).toBeVisible({ timeout: 10000 });

    // Click "Nuevo Pedido" button
    await page.click('button:has-text("Nuevo Pedido")');

    // Wait for modal
    await expect(page.locator('text=Nuevo Pedido Manual')).toBeVisible({ timeout: 5000 });

    // Verify type defaults to MOSTRADOR
    await expect(page.locator('#pedido-tipo')).toHaveValue('MOSTRADOR');

    // Click the E2E category tab first (no .modal class in the DOM)
    await expect(page.locator(`button:has-text("${testData.categoryName}")`)).toBeVisible({ timeout: 10000 });
    await page.click(`button:has-text("${testData.categoryName}")`);

    // Wait for E2E product and click
    await expect(page.locator(`button:has-text("${testData.productName}")`)).toBeVisible({ timeout: 5000 });
    await page.click(`button:has-text("${testData.productName}")`);

    // Handle modifiers modal if it appears - click "Sin modificar" or "Agregar"
    const sinModificar = page.locator('button:has-text("Sin modificar")');
    if (await sinModificar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sinModificar.click();
    }

    // Click create order
    await page.click('[data-testid="manual-order-create-submit"]');

    // Should see success
    await expect(page.locator('text=/Pedido #\\d+ creado/i')).toBeVisible({ timeout: 10000 });
  });

  test('registrar pago EFECTIVO en pedido', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page.locator('h1:has-text("Pedidos")')).toBeVisible({ timeout: 10000 });

    // Wait for orders to load
    await expect(page.locator('text=/#\\d+/').first()).toBeVisible({ timeout: 10000 });

    // Find a payment button
    const payButton = page.locator('button[aria-label^="Registrar pago del pedido"]').first();

    if (await payButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await payButton.click();

      // Fill payment form
      await page.fill('#pago-monto', '5500');
      await page.selectOption('#pago-metodo', 'EFECTIVO');

      // Submit
      await page.click('[data-testid="register-payment-submit"]');

      // Verify success and modal close
      await expect(page.locator('h2:has-text("Registrar Pago")')).not.toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/Pago registrado|pedido cobrado|pendiente de acreditación/i').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
