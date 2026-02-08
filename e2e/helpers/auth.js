const { expect } = require('@playwright/test');

/**
 * Login helper - authenticates and waits for redirect.
 */
async function login(page, email, password, options = {}) {
  const expectedUrl = options.expectedUrl || /\/dashboard/;
  const timeout = options.timeout || 15000;

  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  if (expectedUrl) {
    await expect(page).toHaveURL(expectedUrl, { timeout });
  }
}

module.exports = { login };
