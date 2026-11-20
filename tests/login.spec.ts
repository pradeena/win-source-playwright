import { expect, test } from '@playwright/test';

const LOGIN_URL = '/login';

// These values are intentionally read at runtime. Do not put real credentials
// in this file or commit a .env file containing them.
const email = process.env.WIN_SOURCE_EMAIL;
const password = process.env.WIN_SOURCE_PASSWORD;

test.describe('WIN SOURCE login', () => {
    test('shows a usable login form', async ({ page }) => {
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

        const emailInput = page.locator('input[type="email"], input[name*="email" i]').first();
        const passwordInput = page.locator('input[type="password"]').first();

        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
    });

    test('signs in with configured credentials', async ({ page }) => {
        console.log(`Using email: ${email}, password: ${password ? '***' : '(not set)'}`);
        test.skip(!email || !password, 'Set WIN_SOURCE_EMAIL and WIN_SOURCE_PASSWORD to run the real login test.');

        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

        await page.locator('input[type="email"], input[name*="email" i]').first().fill(email!);
        await page.locator('input[type="password"]').first().fill(password!);

        const submitButton = page
            .getByRole('button', { name: /^(sign in|log in|login)$/i })
            .or(page.locator('input[type="submit"]').first());

        await Promise.all([
            page.waitForLoadState('domcontentloaded'),
            submitButton.click(),
        ]);

        await expect(page).not.toHaveURL(/\/login(?:\?|$)/i, { timeout: 10000 });
    });
});
