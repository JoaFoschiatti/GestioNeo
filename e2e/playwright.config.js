const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  actionTimeout: 10000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true
  },
  webServer: [
    {
      command: 'cd ../backend && npm run dev',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: true,
      timeout: 30000,
      env: {
        NODE_ENV: 'test' // Disable rate limiting for E2E tests
      }
    },
    {
      command: 'cd ../frontend && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000
    }
  ]
});
