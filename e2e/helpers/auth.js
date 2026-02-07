const { expect } = require('@playwright/test');

/**
 * Login helper - authenticates and waits for dashboard redirect.
 */
async function login(page, email, password) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

module.exports = { login };
