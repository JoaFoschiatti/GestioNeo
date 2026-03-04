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
    channel: process.env.PW_CHANNEL || undefined,
    trace: process.env.PW_TRACE || 'on-first-retry',
    screenshot: process.env.PW_SCREENSHOT || 'only-on-failure',
    video: process.env.PW_VIDEO || 'off',
    headless: process.env.PW_HEADLESS ? process.env.PW_HEADLESS === 'true' : true
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
