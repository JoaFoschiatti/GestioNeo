const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Reservas E2E', () => {
  let testData;

  // Helper: tomorrow's date string YYYY-MM-DD and datetime YYYY-MM-DDTHH:mm
  function getTomorrow(hour = 14, minute = 0) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return {
      date: dateStr,
      datetime: `${dateStr}T${pad(hour)}:${pad(minute)}`
    };
  }

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver listado de reservas', async ({ page }) => {
    await page.goto('/reservas');
    await expect(page.locator('h1:has-text("Reservas")')).toBeVisible({ timeout: 10000 });
  });

  test('crear nueva reserva', async ({ page }) => {
    await page.goto('/reservas');
    await expect(page.locator('h1:has-text("Reservas")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nueva Reserva")');

    // Select E2E mesa (mesa 99) by value
    await page.selectOption('#reserva-mesa', String(testData.tableId));

    // Use TOMORROW to guarantee future date
    const { datetime } = getTomorrow(14, 0);
    await page.fill('#reserva-fecha-hora', datetime);

    await page.fill('#reserva-cliente-nombre', 'Cliente E2E Test');
    await page.fill('#reserva-cliente-telefono', '11-5555-0000');
    await page.fill('#reserva-cantidad-personas', '4');

    // Submit
    await page.click('button:has-text("Crear Reserva")');

    // Verify reservation appears (page auto-navigates to reservation date)
    await expect(page.locator('text=Cliente E2E Test')).toBeVisible({ timeout: 5000 });
  });

  test('marcar reserva como Llego', async ({ page }) => {
    await page.goto('/reservas');
    await expect(page.locator('h1:has-text("Reservas")')).toBeVisible({ timeout: 10000 });

    // Change date filter to tomorrow (where our reservation was created)
    const { date } = getTomorrow();
    await page.fill('input[type="date"]', date);
    await page.waitForTimeout(500);

    // Wait for reservation to appear
    await expect(page.locator('text=Cliente E2E Test')).toBeVisible({ timeout: 10000 });

    // Click "Llegó" button
    const llegoButton = page.locator('button:has-text("Llegó")').first();
    await llegoButton.click();

    // Verify state changed to "Presente" (use .first() to avoid matching toast "Cliente presente")
    await expect(page.locator('text=Presente').first()).toBeVisible({ timeout: 5000 });
  });

  test('cancelar reserva', async ({ page }) => {
    // First create another reservation to cancel
    await page.goto('/reservas');
    await expect(page.locator('h1:has-text("Reservas")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nueva Reserva")');

    // Select a different mesa (mesa 99 has a Presente reservation from previous test)
    await page.selectOption('#reserva-mesa', { index: 2 });

    // Use tomorrow at a different time
    const { datetime } = getTomorrow(15, 0);
    await page.fill('#reserva-fecha-hora', datetime);

    await page.fill('#reserva-cliente-nombre', 'E2E Cancelar Test');
    await page.fill('#reserva-cantidad-personas', '2');

    await page.click('button:has-text("Crear Reserva")');
    await expect(page.locator('text=E2E Cancelar Test')).toBeVisible({ timeout: 5000 });

    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Click cancel button
    await page.click('button[aria-label="Cancelar reserva: E2E Cancelar Test"]');

    // Verify state changed
    await expect(page.locator('text=Cancelada').first()).toBeVisible({ timeout: 5000 });
  });
});
