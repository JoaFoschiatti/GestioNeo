const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const testDataPath = path.join(__dirname, '..', '.e2e-test-data.json');

test.describe('Reservas E2E', () => {
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

  test('ver listado de reservas', async ({ page }) => {
    await page.goto('/reservas');

    // Page should load without errors
    await expect(page.locator('text=Reservas, h1:has-text("Reservas")')).toBeVisible({ timeout: 10000 });
  });

  test('crear nueva reserva', async ({ page }) => {
    await page.goto('/reservas');

    // Click new reservation button
    await page.click('button:has-text("Nueva Reserva")');

    // Fill form
    await page.fill('input[name="clienteNombre"], input#clienteNombre', 'Cliente E2E');
    await page.fill('input[name="clienteTelefono"], input#clienteTelefono', '123456789');
    await page.fill('input[name="personas"], input#personas', '2');

    // Select date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[type="date"]', dateStr);

    // Select time
    await page.fill('input[type="time"]', '20:00');

    // Select table if required
    const mesaSelect = page.locator('select#mesaId, select[name="mesaId"]');
    if (await mesaSelect.isVisible()) {
      await mesaSelect.selectOption({ index: 1 });
    }

    // Submit
    await page.click('button:has-text("Crear"), button:has-text("Guardar")');

    // Wait
    await page.waitForTimeout(1000);

    // Verify no validation error
    const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
    expect(errorVisible).toBe(false);
  });
});
