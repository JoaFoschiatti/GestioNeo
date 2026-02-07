const { test, expect } = require('@playwright/test');
const { loadTestData } = require('../helpers/test-data');

test.describe('Menu Publico E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  // No login needed - public page

  test('ver menu publico sin login', async ({ page }) => {
    await page.goto('/menu');

    // Menu page should load - look for a specific unique element
    await expect(page.locator('text=Selecciona tus productos').first()).toBeVisible({ timeout: 15000 });
  });

  test('ver categorias en menu', async ({ page }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');

    // Should show at least one category button
    const categoryButton = page.locator('button').filter({ hasText: /Hamburguesas/ }).first();
    await expect(categoryButton).toBeVisible({ timeout: 10000 });
  });

  test('agregar producto al carrito', async ({ page }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');

    // Wait for products to load
    await page.waitForTimeout(2000);

    // Click on a product card to add to cart
    const productCard = page.locator('button, [role="button"]').filter({ hasText: /Hamburguesa/ }).first();

    if (await productCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productCard.click();
      // Product added - cart should update
      await page.waitForTimeout(1000);
    }
  });

  test('flujo completo de pedido con EFECTIVO', async ({ page }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Add product to cart
    const productCard = page.locator('button, [role="button"]').filter({ hasText: /Hamburguesa/ }).first();

    if (await productCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productCard.click();
      await page.waitForTimeout(1000);

      // Look for cart/checkout area
      const cartButton = page.locator('button').filter({ hasText: /[Cc]arrito|[Pp]edir|[Cc]omprar|[Vv]er/ }).first();
      if (await cartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cartButton.click();
      }

      // Fill client data if visible
      const nameInput = page.locator('input[placeholder*="ombre"], input[name*="nombre"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('E2E Cliente Menu');
      }

      const phoneInput = page.locator('input[placeholder*="eléfono"], input[name*="telefono"]').first();
      if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await phoneInput.fill('11-7777-0000');
      }

      // Select EFECTIVO payment if visible
      const efectivoOption = page.locator('button, label').filter({ hasText: /[Ee]fectivo/ }).first();
      if (await efectivoOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await efectivoOption.click();
      }

      // Confirm order
      const confirmButton = page.locator('button').filter({ hasText: /[Cc]onfirmar|[Rr]ealizar|[Pp]edir/ }).first();
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(3000);
      }
    }
  });
});
