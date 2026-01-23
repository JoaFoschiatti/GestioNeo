const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const testDataPath = path.join(__dirname, '..', '.e2e-test-data.json');

test.describe('Cierres de Caja E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
  });

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[placeholder="mi-restaurante"]', testData.tenantSlug);
    await page.fill('input[type="email"]', testData.userEmail);
    await page.fill('input[type="password"]', testData.userPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('ver pagina de cierre de caja', async ({ page }) => {
    await page.goto('/cierre-caja');

    // Page should load
    await expect(page.locator('text=/[Cc]ierre|[Cc]aja/')).toBeVisible({ timeout: 10000 });
  });

  test('abrir caja con fondo inicial', async ({ page }) => {
    await page.goto('/cierre-caja');

    // Check if cash register is closed (shows open button)
    const openButton = page.locator('button:has-text("Abrir Caja")');

    if (await openButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Fill initial fund
      const fondoInput = page.locator('input[name="fondoInicial"], input#fondoInicial, input[type="number"]');
      if (await fondoInput.isVisible()) {
        await fondoInput.fill('10000');
      }

      // Click open
      await openButton.click();

      // Wait
      await page.waitForTimeout(1000);

      // Verify no validation error
      const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
      expect(errorVisible).toBe(false);
    }

    // If already open, just verify the page loads correctly
    await expect(page.locator('text=/[Cc]ierre|[Cc]aja|[Rr]esumen/')).toBeVisible();
  });
});
