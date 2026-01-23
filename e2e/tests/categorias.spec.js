const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const testDataPath = path.join(__dirname, '..', '.e2e-test-data.json');

test.describe('Categorias E2E', () => {
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

  test('ver listado de categorias', async ({ page }) => {
    await page.goto('/categorias');

    // Should show existing category from setup
    await expect(page.locator('text=Hamburguesas')).toBeVisible({ timeout: 10000 });
  });

  test('crear nueva categoria', async ({ page }) => {
    await page.goto('/categorias');

    // Click new category button
    await page.click('button:has-text("Nueva Categoria"), button:has-text("Nueva Categoría")');

    // Fill form
    await page.fill('input[name="nombre"], input#nombre', 'Bebidas E2E');

    // Submit
    await page.click('button:has-text("Crear"), button:has-text("Guardar")');

    // Wait and verify
    await page.waitForTimeout(1000);

    // Verify no validation error
    const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
    expect(errorVisible).toBe(false);

    // Should show new category
    await expect(page.locator('text=Bebidas E2E')).toBeVisible({ timeout: 5000 });
  });

  test('editar categoria existente', async ({ page }) => {
    await page.goto('/categorias');

    // Wait for categories to load
    await page.waitForSelector('text=Hamburguesas', { timeout: 10000 });

    // Click edit on Hamburguesas
    const row = page.locator('tr, div').filter({ hasText: 'Hamburguesas' }).first();
    await row.locator('button:has-text("Editar"), button[title="Editar"], svg').first().click();

    // Change name
    await page.fill('input[name="nombre"], input#nombre', 'Hamburguesas Editada');

    // Submit
    await page.click('button:has-text("Guardar"), button:has-text("Actualizar")');

    // Wait
    await page.waitForTimeout(1000);

    // Verify no error
    const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
    expect(errorVisible).toBe(false);
  });
});
