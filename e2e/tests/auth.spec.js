const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const testDataPath = path.join(__dirname, '..', '.e2e-test-data.json');

test.describe('Auth E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
  });

  test('login exitoso con credenciales correctas', async ({ page }) => {
    await page.goto('/login');

    // Fill login form
    await page.fill('input[placeholder="mi-restaurante"]', testData.tenantSlug);
    await page.fill('input[type="email"]', testData.userEmail);
    await page.fill('input[type="password"]', testData.userPassword);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Should show user name in sidebar
    await expect(page.locator('text=Admin E2E')).toBeVisible();
  });

  test('login fallido con credenciales incorrectas', async ({ page }) => {
    await page.goto('/login');

    // Fill with wrong password
    await page.fill('input[placeholder="mi-restaurante"]', testData.tenantSlug);
    await page.fill('input[type="email"]', testData.userEmail);
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/[Cc]redenciales|[Ii]nv[aá]lid/')).toBeVisible({ timeout: 5000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('login fallido con tenant inexistente', async ({ page }) => {
    await page.goto('/login');

    // Fill with non-existent tenant
    await page.fill('input[placeholder="mi-restaurante"]', 'tenant-que-no-existe');
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'password123');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('[role="alert"], .bg-red-500')).toBeVisible({ timeout: 5000 });

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout cierra sesion correctamente', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[placeholder="mi-restaurante"]', testData.tenantSlug);
    await page.fill('input[type="email"]', testData.userEmail);
    await page.fill('input[type="password"]', testData.userPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Click logout (look for link with "Cerrar" text)
    await page.click('a:has-text("Cerrar"), button:has-text("Cerrar")');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('acceso a ruta protegida sin login redirige a login', async ({ page }) => {
    // Try to access protected route directly
    await page.goto('/pedidos');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
