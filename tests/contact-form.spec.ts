import { expect, test, type Page } from '@playwright/test';

const CONTACT_URL = '/contactus.html';

// Scope every lookup to the contact form itself: the page also has a site-wide
// search box and other forms whose inputs/buttons would otherwise match first.
function contactForm(page: Page) {
    const form = page.locator('#contactus-form');
    return {
        form,
        name: form.locator('#FullName'),
        email: form.locator('#Email'),
        enquiry: form.locator('#Enquiry'),
        submit: form.getByRole('button', { name: 'Submit' }),
        captcha: form.locator('.captcha-box'),
    };
}

test.describe('WIN SOURCE contact page', () => {
    test.beforeEach(async ({ page }) => {
        // The site keeps background requests (analytics, maps) running, so
        // "networkidle" never settles; wait for the DOM instead.
        await page.goto(CONTACT_URL, { waitUntil: 'domcontentloaded' });
    });

    test('shows the contact page and form', async ({ page }) => {
        await expect(page).toHaveTitle(/Contact Us/);
        await expect(page.getByRole('heading', { level: 1, name: 'Contact Us' })).toBeVisible();

        const { name, email, enquiry, submit } = contactForm(page);
        await expect(name).toBeVisible();
        await expect(email).toBeVisible();
        await expect(enquiry).toBeVisible();
        await expect(submit).toBeVisible();
    });

    test('accepts input in every field', async ({ page }) => {
        const { name, email, enquiry } = contactForm(page);

        await name.fill('Playwright Test User');
        await email.fill('test@example.com');
        await enquiry.fill('Automated Playwright test message - please ignore.');

        await expect(name).toHaveValue('Playwright Test User');
        await expect(email).toHaveValue('test@example.com');
        await expect(enquiry).toHaveValue('Automated Playwright test message - please ignore.');
    });

    test('submits the enquiry', async ({ page }) => {
        const { name, email, enquiry, submit, captcha } = contactForm(page);

        // The form is protected by a CAPTCHA that the automation header does not
        // bypass, so a scripted submission is rejected. Re-enable this test once
        // the CAPTCHA is disabled for automated traffic in test environments.
        test.fixme(
            (await captcha.count()) > 0,
            'Contact form is CAPTCHA-protected; submission cannot be automated.',
        );

        await name.fill('Playwright Test User');
        await email.fill('test@example.com');
        await enquiry.fill('Automated Playwright test message - please ignore.');
        await submit.click();

        await expect(page.getByText(/enquiry has been successfully sent/i)).toBeVisible({ timeout: 15_000 });
    });
});
