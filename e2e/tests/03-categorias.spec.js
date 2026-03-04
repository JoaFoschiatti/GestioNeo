const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Categorias E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver listado de categorias', async ({ page }) => {
    await page.goto('/categorias');
    await expect(page.locator('h1:has-text("Categorías")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testData.categoryName}`)).toBeVisible();
  });

  test('crear nueva categoria', async ({ page }) => {
    await page.goto('/categorias');
    await expect(page.locator('h1:has-text("Categorías")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nueva Categoría")');

    // Fill form
    await page.fill('#categoria-nombre', 'E2E Bebidas Test');
    await page.fill('#categoria-orden', '50');

    // Submit
    await page.click('button:has-text("Crear")');

    // Verify new category appears
    await expect(page.locator('text=E2E Bebidas Test')).toBeVisible({ timeout: 5000 });
  });

  test('editar categoria existente', async ({ page }) => {
    await page.goto('/categorias');
    await expect(page.locator(`text=${testData.categoryName}`)).toBeVisible({ timeout: 10000 });

    // Click edit button
    await page.click(`button[aria-label="Editar categoría: ${testData.categoryName}"]`);

    // Change description
    await page.fill('#categoria-descripcion', 'Descripcion editada E2E');

    // Submit
    await page.click('button:has-text("Guardar")');

    // Verify update
    await expect(page.locator('text=Descripcion editada E2E')).toBeVisible({ timeout: 5000 });
  });

  test('eliminar categoria', async ({ page }) => {
    await page.goto('/categorias');
    await expect(page.locator('text=E2E Bebidas Test')).toBeVisible({ timeout: 10000 });

    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete button
    await page.click('button[aria-label="Eliminar categoría: E2E Bebidas Test"]');

    // Verify removed
    await expect(page.locator('text=E2E Bebidas Test')).not.toBeVisible({ timeout: 5000 });
  });
});
