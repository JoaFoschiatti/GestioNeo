const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { loadTestData } = require('../helpers/test-data');

test.describe('Auth E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = loadTestData();
  });

  test('login exitoso con credenciales correctas', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', testData.userEmail);
    await page.fill('input[type="password"]', testData.userPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Admin E2E')).toBeVisible({ timeout: 5000 });
  });

  test('login fallido con password incorrecto', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', testData.userEmail);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('login fallido con email inexistente', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'noexiste@fake.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout cierra sesion correctamente', async ({ page }) => {
    await login(page, testData.userEmail, testData.userPassword);

    await page.click('button:has-text("Cerrar sesión")');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('acceso a ruta protegida sin login redirige a login', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
