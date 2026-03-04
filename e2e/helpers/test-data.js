const fs = require('fs');
const path = require('path');

const TEST_DATA_PATH = path.join(__dirname, '..', '.e2e-test-data.json');

/**
 * Load test data created by global-setup.
 */
function loadTestData() {
  return JSON.parse(fs.readFileSync(TEST_DATA_PATH, 'utf-8'));
}

module.exports = { loadTestData };
