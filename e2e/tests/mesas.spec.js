const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const testDataPath = path.join(__dirname, '..', '.e2e-test-data.json');

test.describe('Mesas E2E', () => {
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

  test('ver listado de mesas', async ({ page }) => {
    await page.goto('/mesas');

    // Should show existing table
    await expect(page.locator('text=4 personas')).toBeVisible({ timeout: 10000 });
  });

  test('crear nueva mesa', async ({ page }) => {
    await page.goto('/mesas');

    // Click new table button
    await page.click('button:has-text("Nueva Mesa")');

    // Fill form
    await page.fill('input[name="numero"], input#numero', '99');
    await page.fill('input[name="capacidad"], input#capacidad', '6');

    // Submit
    await page.click('button:has-text("Crear"), button:has-text("Guardar")');

    // Should show success or new table in list
    await page.waitForTimeout(1000);

    // Verify no validation error
    const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
    expect(errorVisible).toBe(false);
  });

  test('editar mesa existente', async ({ page }) => {
    await page.goto('/mesas');

    // Wait for tables to load
    await page.waitForSelector('text=4 personas', { timeout: 10000 });

    // Click edit button on first table
    const editButton = page.locator('button[title="Editar"], button:has-text("Editar"), svg').first();
    await editButton.click();

    // Change capacity
    await page.fill('input[name="capacidad"], input#capacidad', '8');

    // Submit
    await page.click('button:has-text("Guardar"), button:has-text("Actualizar")');

    // Wait for update
    await page.waitForTimeout(1000);

    // Verify no error
    const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
    expect(errorVisible).toBe(false);
  });
});
