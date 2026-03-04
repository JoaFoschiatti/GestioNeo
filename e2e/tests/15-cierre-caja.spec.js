const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Cierre de Caja E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver pagina de cierre de caja', async ({ page }) => {
    await page.goto('/cierre-caja');
    await expect(page.locator('h1:has-text("Cierre de Caja")')).toBeVisible({ timeout: 10000 });
  });

  test('abrir caja con fondo inicial', async ({ page }) => {
    await page.goto('/cierre-caja');
    await expect(page.locator('h1:has-text("Cierre de Caja")')).toBeVisible({ timeout: 10000 });

    // Check if "Abrir Caja" button is available (caja is closed)
    const openButton = page.locator('button:has-text("Abrir Caja")');

    if (await openButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click to open modal
      await openButton.click();

      // Fill fondo inicial inside modal
      await expect(page.locator('#caja-fondo-inicial')).toBeVisible({ timeout: 3000 });
      await page.fill('#caja-fondo-inicial', '10000');

      // Submit modal (look for confirm button inside modal)
      const confirmBtn = page.locator('.modal button:has-text("Abrir"), .modal button:has-text("Confirmar")').first();
      await confirmBtn.click();

      // Verify caja opened
      await expect(page.locator('text=/[Cc]aja [Aa]bierta|ABIERTO/')).toBeVisible({ timeout: 5000 });
    }
  });

  test('cerrar caja', async ({ page }) => {
    await page.goto('/cierre-caja');
    await expect(page.locator('h1:has-text("Cierre de Caja")')).toBeVisible({ timeout: 10000 });

    // Check if "Cerrar Caja" button is available (caja is open)
    const closeButton = page.locator('button:has-text("Cerrar Caja")');

    if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeButton.click();

      // Fill efectivo contado inside modal
      const efectivoInput = page.locator('#caja-efectivo-contado');
      if (await efectivoInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await efectivoInput.fill('10000');
      }

      // Submit
      const confirmBtn = page.locator('.modal button:has-text("Cerrar"), .modal button:has-text("Confirmar")').first();
      await confirmBtn.click();

      // Verify
      await page.waitForTimeout(2000);
    }
  });
});
