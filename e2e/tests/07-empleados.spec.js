const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Empleados E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);
  });

  test('ver listado de empleados', async ({ page }) => {
    await page.goto('/empleados');
    await expect(page.locator('h1:has-text("Empleados")')).toBeVisible({ timeout: 10000 });
    // Verify E2E employee from setup - use full name to avoid ambiguity
    await expect(page.locator('text=Test E2E').first()).toBeVisible();
  });

  test('crear empleado', async ({ page }) => {
    await page.goto('/empleados');
    await expect(page.locator('h1:has-text("Empleados")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Nuevo Empleado")');

    // Fill form
    await page.fill('#empleado-nombre', 'Carlos');
    await page.fill('#empleado-apellido', 'E2E');
    await page.fill('#empleado-dni', '99988877');
    await page.fill('#empleado-telefono', '11-1234-5678');
    await page.selectOption('#empleado-rol', 'COCINERO');
    await page.fill('#empleado-tarifa', '2000');

    // Submit
    await page.click('button:has-text("Crear")');

    // Verify
    await expect(page.locator('text=Carlos').first()).toBeVisible({ timeout: 5000 });
  });

  test('editar empleado', async ({ page }) => {
    await page.goto('/empleados');
    await expect(page.locator('h1:has-text("Empleados")')).toBeVisible({ timeout: 10000 });

    // Click edit button for E2E employee
    await page.click('button[aria-label="Editar empleado: Test E2E"]');

    // Change phone
    await page.fill('#empleado-telefono', '11-9999-0000');

    // Submit
    await page.click('button:has-text("Guardar")');

    // Verify
    await expect(page.locator('text=11-9999-0000')).toBeVisible({ timeout: 5000 });
  });
});
