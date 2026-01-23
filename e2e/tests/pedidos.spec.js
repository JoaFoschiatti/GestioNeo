const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Load test data created by global-setup
const testDataPath = path.join(__dirname, '..', '.e2e-test-data.json');

test.describe('Pedidos E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');

    // Fill tenant slug (restaurante field)
    await page.fill('input[placeholder="mi-restaurante"]', testData.tenantSlug);
    await page.fill('input[type="email"]', testData.userEmail);
    await page.fill('input[type="password"]', testData.userPassword);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('crear pedido en mesa sin error de validacion', async ({ page }) => {
    // Navigate to mozo mesas page (for making orders, not config)
    await page.goto('/mozo/mesas');
    await expect(page).toHaveURL(/\/mozo\/mesas/, { timeout: 5000 });

    // Wait for tables to load - look for the table card with "4 personas"
    await page.waitForSelector('text=4 personas', { timeout: 10000 });

    // Click on the table card - the card contains the table number and capacity
    const mesaCard = page.locator('div').filter({ hasText: '4 personas' }).first();
    await mesaCard.click();

    // Should navigate to new order page
    await page.waitForURL(/\/mozo\/nuevo-pedido/, { timeout: 5000 });

    // Wait for products to load
    await page.waitForSelector(`text=${testData.productName}`, { timeout: 10000 });

    // Click on product to add to cart
    await page.click(`button:has-text("${testData.productName}")`);

    // Wait for product to appear in cart (look for quantity selector area)
    await page.waitForSelector(`text=${testData.productName}`, { timeout: 5000 });

    // Click confirm order button
    await page.click('button:has-text("Confirmar Pedido")');

    // Should NOT see "Datos invalidos" error
    await page.waitForTimeout(2000); // Wait for response
    const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
    expect(errorVisible).toBe(false);

    // Should see success message with order number
    await expect(page.locator('text=/Pedido #\\d+/')).toBeVisible({ timeout: 10000 });
  });

  test('crear pedido MOSTRADOR desde modal sin error de validacion', async ({ page }) => {
    // Navigate directly to pedidos page
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/pedidos/, { timeout: 5000 });

    // Click "Nuevo Pedido" button
    await page.click('button:has-text("Nuevo Pedido")');

    // Wait for modal to open
    await page.waitForSelector('text=Nuevo Pedido Manual', { timeout: 5000 });

    // Type should be MOSTRADOR by default
    const tipoSelect = page.locator('select#pedido-tipo');
    await expect(tipoSelect).toHaveValue('MOSTRADOR');

    // Wait for products to load
    await page.waitForSelector(`text=${testData.productName}`, { timeout: 10000 });

    // Click on product to add to cart
    await page.click(`button:has-text("${testData.productName}")`);

    // Wait for product in cart
    await page.waitForTimeout(500);

    // Click create order button
    await page.click('button:has-text("Crear Pedido")');

    // Should NOT see "Datos invalidos" error
    await page.waitForTimeout(2000);
    const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
    expect(errorVisible).toBe(false);

    // Should see success toast
    await expect(page.locator('text=/Pedido #\\d+ creado/i')).toBeVisible({ timeout: 10000 });
  });

  test('crear pedido tipo MESA desde modal', async ({ page }) => {
    // Navigate directly to pedidos page
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/pedidos/, { timeout: 5000 });

    // Click "Nuevo Pedido" button
    await page.click('button:has-text("Nuevo Pedido")');

    // Wait for modal to open
    await page.waitForSelector('text=Nuevo Pedido Manual', { timeout: 5000 });

    // Change type to MESA
    await page.selectOption('select#pedido-tipo', 'MESA');

    // Select table (wait for table select to appear)
    await page.waitForSelector('select#pedido-mesa', { timeout: 5000 });
    await page.selectOption('select#pedido-mesa', { index: 1 });

    // Wait for products to load
    await page.waitForSelector(`text=${testData.productName}`, { timeout: 10000 });

    // Click on product to add to cart
    await page.click(`button:has-text("${testData.productName}")`);

    // Click create order button
    await page.click('button:has-text("Crear Pedido")');

    // Should NOT see "Datos invalidos" error
    await page.waitForTimeout(2000);
    const errorVisible = await page.locator('text=/[Dd]atos [Ii]nv[aá]lidos/').isVisible();
    expect(errorVisible).toBe(false);

    // Should see success toast
    await expect(page.locator('text=/Pedido #\\d+ creado/i')).toBeVisible({ timeout: 10000 });
  });
});
