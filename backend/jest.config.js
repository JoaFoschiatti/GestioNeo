module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
