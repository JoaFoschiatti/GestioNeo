const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Roles E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.describe('MOZO', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, testData.mozoEmail, testData.mozoPassword, {
        expectedUrl: /\/mesas/,
        timeout: 20000
      });
    });

    test('puede crear pedido DELIVERY desde nuevo pedido', async ({ page }) => {
      await page.goto('/mozo/nuevo-pedido');
      await expect(page.locator('#pedido-tipo-mozo')).toBeVisible({ timeout: 10000 });

      await page.selectOption('#pedido-tipo-mozo', 'DELIVERY');
      await page.fill('#pedido-cliente-nombre', 'E2E Cliente Roles');
      await page.fill('#pedido-cliente-telefono', '11-7777-0000');
      await page.fill('#pedido-cliente-direccion', 'Calle Roles 123');

      await page.click(`button:has-text("${testData.categoryName}")`);
      await expect(page.locator(`button:has-text("${testData.productName}")`)).toBeVisible({ timeout: 5000 });
      await page.click(`button:has-text("${testData.productName}")`);

      const sinModificar = page.locator('button:has-text("Sin modificar")');
      if (await sinModificar.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sinModificar.click();
      }

      await page.click('[data-testid="order-confirm-submit"]');
      await expect(page.locator('text=/Pedido #\\d+/')).toBeVisible({ timeout: 10000 });
    });

    test('no puede acceder a configuracion', async ({ page }) => {
      await page.goto('/configuracion');
      await expect(page).toHaveURL(/\/mesas/, { timeout: 10000 });
      await expect(page.locator('button:has-text("Operación")')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('COCINERO', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, testData.cocineroEmail, testData.cocineroPassword, {
        expectedUrl: /\/dashboard/,
        timeout: 20000
      });
    });

    test('puede ver pantalla de cocina', async ({ page }) => {
      await page.goto('/cocina');
      await expect(page.locator('h1:has-text("Cocina")')).toBeVisible({ timeout: 10000 });
    });

    test('no puede acceder a mesas', async ({ page }) => {
      await page.goto('/mesas');
      await expect(page).toHaveURL(/\/cocina/, { timeout: 10000 });
      await expect(page.locator('h1:has-text("Cocina")')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('DELIVERY', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, testData.deliveryEmail, testData.deliveryPassword, {
        expectedUrl: /\/delivery\/pedidos/,
        timeout: 20000
      });
    });

    test('puede ver pagina de entregas', async ({ page }) => {
      await expect(page.locator('h1:has-text("Mis Entregas")')).toBeVisible({ timeout: 10000 });
    });

    test('no puede acceder a dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/delivery\/pedidos/, { timeout: 10000 });
      await expect(page.locator('h1:has-text("Mis Entregas")')).toBeVisible({ timeout: 10000 });
    });
  });
});
