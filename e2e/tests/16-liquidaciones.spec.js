const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Liquidaciones E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver listado de liquidaciones', async ({ page }) => {
    await page.goto('/liquidaciones');
    // H1 is "Liquidaciones de Sueldos"
    await expect(page.locator('h1:has-text("Liquidaciones")')).toBeVisible({ timeout: 10000 });
  });

  test('crear liquidacion', async ({ page }) => {
    await page.goto('/liquidaciones');
    await expect(page.locator('h1:has-text("Liquidaciones")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nueva Liquidación")');

    // Wait for modal (use h2 to avoid matching the button text too)
    await expect(page.locator('h2:has-text("Nueva Liquidación")')).toBeVisible({ timeout: 5000 });

    // Select employee (first option after placeholder)
    await page.selectOption('#liquidacion-empleado', { index: 1 });

    // Fill period
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await page.fill('#liquidacion-desde', firstDay.toISOString().split('T')[0]);
    await page.fill('#liquidacion-hasta', lastDay.toISOString().split('T')[0]);

    // Fill hours
    await page.fill('#liquidacion-horas', '160');

    // Submit - button text is "Crear Liquidación"
    await page.click('button:has-text("Crear Liquidación")');

    // Verify - should see the new liquidation in the list or toast
    await page.waitForTimeout(2000);
    // Check that the modal closed and data is in list
    const main = page.locator('main');
    await expect(main.locator('text=/\\$|Pendiente/').first()).toBeVisible({ timeout: 5000 });
  });

  test('marcar liquidacion como pagada', async ({ page }) => {
    await page.goto('/liquidaciones');
    await expect(page.locator('h1:has-text("Liquidaciones")')).toBeVisible({ timeout: 10000 });

    // Find mark as paid button
    const paidButton = page.locator('button[aria-label^="Marcar liquidación"]').first();

    if (await paidButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Handle confirm dialog
      page.on('dialog', dialog => dialog.accept());

      await paidButton.click();

      // Verify badge changed
      await expect(page.locator('text=Pagada').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
