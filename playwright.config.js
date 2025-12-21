const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    retries: 0,
    workers: 1, // Sequential execution for SQLite safety
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'node server.js',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120 * 1000,
    },
});
