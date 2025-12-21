const { test, expect } = require('@playwright/test');

/**
 * Al-Shorouk Radiology System - Smoke Tests
 * These tests verify critical user paths work correctly
 */

test.describe('Authentication', () => {
    test('Login Page Loads Correctly', async ({ page }) => {
        await page.goto('http://localhost:3000/login');

        // Verify page structure
        await expect(page).toHaveTitle(/Login/);
        await expect(page.locator('h1')).toContainText('Al-Shorouk Radiology');

        // Verify form elements
        await expect(page.locator('#username')).toBeVisible();
        await expect(page.locator('#password')).toBeVisible();
        await expect(page.locator('#loginBtn')).toBeVisible();

        // Verify accessibility
        await expect(page.locator('form[aria-label]')).toBeVisible();
    });

    test('Admin Login and Logout Flow', async ({ page }) => {
        await page.goto('http://localhost:3000/login');

        // Login as Admin
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');

        // Verify redirection to Admin Dashboard
        await expect(page).toHaveURL(/.*\/admin/);
        await expect(page.locator('body')).toContainText('Dashboard Overview');

        // Verify user info displayed
        await expect(page.locator('.user-info')).toContainText('Administrator');

        // Test logout
        await page.click('button[type="submit"]:has-text("Logout")');
        await expect(page).toHaveURL(/.*\/login/);
    });

    test('Nurse Login Flow', async ({ page }) => {
        await page.goto('http://localhost:3000/login');

        // Login as Nurse
        await page.fill('input[name="username"]', 'nurse');
        await page.fill('input[name="password"]', 'nurse');
        await page.click('button[type="submit"]');

        // Verify redirection to Nurse Dashboard
        await expect(page).toHaveURL(/.*\/nurse/);
        await expect(page.locator('body')).toContainText('Nurse Dashboard');
    });

    test('Radiologist Login Flow', async ({ page }) => {
        await page.goto('http://localhost:3000/login');

        // Login as Radiologist
        await page.fill('input[name="username"]', 'radiologist');
        await page.fill('input[name="password"]', 'radiologist');
        await page.click('button[type="submit"]');

        // Verify redirection to Radiologist Dashboard
        await expect(page).toHaveURL(/.*\/radiologist/);
    });

    test('Invalid Login Shows Error', async ({ page }) => {
        await page.goto('http://localhost:3000/login');

        // Try invalid credentials
        await page.fill('input[name="username"]', 'invalid_user');
        await page.fill('input[name="password"]', 'wrong_password');
        await page.click('button[type="submit"]');

        // Verify error message is displayed
        await expect(page.locator('.alert-danger')).toContainText('Invalid');
    });
});

test.describe('Admin Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Login as admin before each test
        await page.goto('http://localhost:3000/login');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/admin/);
    });

    test('Dashboard Shows Statistics', async ({ page }) => {
        // Verify stat cards are present
        await expect(page.locator('text=Total Patients')).toBeVisible();
        await expect(page.locator('text=Active Visits')).toBeVisible();
        await expect(page.locator('text=Assessments')).toBeVisible();
        await expect(page.locator('text=System Users')).toBeVisible();
    });

    test('User Management Page Loads', async ({ page }) => {
        await page.goto('http://localhost:3000/admin/users');

        // Verify page structure
        await expect(page.locator('h1')).toContainText('User Management');

        // Verify filter controls
        await expect(page.locator('#search')).toBeVisible();
        await expect(page.locator('#role')).toBeVisible();
        await expect(page.locator('#status')).toBeVisible();

        // Verify users table or empty state
        const hasTable = await page.locator('.table').isVisible();
        const hasEmptyState = await page.locator('text=No users found').isVisible();
        expect(hasTable || hasEmptyState).toBeTruthy();
    });

    test('Add New User Page Loads', async ({ page }) => {
        await page.goto('http://localhost:3000/admin/users/new');

        // Verify form elements
        await expect(page.locator('input[name="username"]')).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('select[name="role"]')).toBeVisible();
    });
});

test.describe('Nurse Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Login as nurse before each test
        await page.goto('http://localhost:3000/login');
        await page.fill('input[name="username"]', 'nurse');
        await page.fill('input[name="password"]', 'nurse');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/.*\/nurse/);
    });

    test('Dashboard Shows Patient Search', async ({ page }) => {
        // Verify patient search is available
        await expect(page.locator('text=Search Patient')).toBeVisible();
    });

    test('Patient Search Page Loads', async ({ page }) => {
        await page.goto('http://localhost:3000/nurse/search-patient');

        // Verify search form
        await expect(page.locator('input[name="ssn"]')).toBeVisible();
    });

    test('Add Patient Page Loads', async ({ page }) => {
        await page.goto('http://localhost:3000/nurse/add-patient');

        // Verify patient form elements
        await expect(page.locator('input[name="ssn"]')).toBeVisible();
        await expect(page.locator('input[name="full_name"]')).toBeVisible();
    });

    test('My Assessments Page Loads', async ({ page }) => {
        await page.goto('http://localhost:3000/nurse/my-assessments');

        // Verify page loads without error
        await expect(page.locator('h1, h2')).toContainText(/Assessment|Nurse/);
    });
});

test.describe('Accessibility', () => {
    test('Skip Links Work on Admin Dashboard', async ({ page }) => {
        await page.goto('http://localhost:3000/login');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');

        // Verify skip link exists
        const skipLink = page.locator('.skip-link').first();
        await expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    test('Main Content Has role="main"', async ({ page }) => {
        await page.goto('http://localhost:3000/login');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');

        // Verify main content landmark
        await expect(page.locator('[role="main"], main')).toBeVisible();
    });

    test('Navigation Has ARIA Label', async ({ page }) => {
        await page.goto('http://localhost:3000/login');
        await page.fill('input[name="username"]', 'admin');
        await page.fill('input[name="password"]', 'admin');
        await page.click('button[type="submit"]');

        // Verify navigation landmark
        await expect(page.locator('nav[aria-label]')).toBeVisible();
    });

    test('Accessibility CSS Loads', async ({ page }) => {
        const response = await page.goto('http://localhost:3000/css/accessibility.css');

        // Verify CSS file is served
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('css');
    });
});

test.describe('Static Assets', () => {
    test('Custom CSS Loads', async ({ page }) => {
        const response = await page.goto('http://localhost:3000/css/custom.css');
        expect(response.status()).toBe(200);
    });

    test('Theme CSS Loads', async ({ page }) => {
        const response = await page.goto('http://localhost:3000/css/theme.css');
        expect(response.status()).toBe(200);
    });
});

test.describe('API Endpoints', () => {
    test('Patient Search API Returns JSON', async ({ page, request }) => {
        // First login to get session
        await page.goto('http://localhost:3000/login');
        await page.fill('input[name="username"]', 'nurse');
        await page.fill('input[name="password"]', 'nurse');
        await page.click('button[type="submit"]');

        // Get cookies from browser context
        const cookies = await page.context().cookies();

        // Make API request with session cookie
        const response = await request.get('http://localhost:3000/api/patients/search?term=test', {
            headers: {
                Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ')
            }
        });

        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/json');
    });
});
