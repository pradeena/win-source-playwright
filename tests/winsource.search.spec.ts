import { test, expect, Page } from '@playwright/test';

// A stable, currently listed component. Change this value to test another part.


test.describe.serial('WinSource Search', () => {
    let page: Page
    const siteUrl = 'https://win-source.net/';
    let productsearchUrl: string = "";
    const PART_NUMBER = 'LM358BI';
    let productLink = '';


    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
    });

    test.afterAll(async () => {
        await page.close();
    });

    test('Step 1: Create an account', async () => {
        await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
        // The site exposes the main search field with this placeholder.
        const searchBox = page.getByPlaceholder('Search Parts').first();
        await expect(searchBox).toBeVisible();
        await searchBox.fill(PART_NUMBER);
        await searchBox.press('Enter');

        // A results page should load and contain at least one product detail link.
        await expect(page).toHaveURL(/\/search\?/);
        productsearchUrl = page.url();
    });

    test('Step 2: Search results display the correct product links', async ({ page }) => {
        await page.goto(productsearchUrl, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: new RegExp(`All Results for\\s*[\\"']?${PART_NUMBER}`, 'i') })).toBeVisible();

        const productLinks = page.locator('a[href*="/products/detail/"]');
        await expect(productLinks.first()).toBeVisible();
        expect(await productLinks.count()).toBeGreaterThan(0);
        productLink = await productLinks.first().getAttribute('href') || '';
        // Open the first displayed product and verify the core product details.
        await productLinks.first().click();
        await expect(page).toHaveURL(/\/products\/detail\//);
    });

    test('Step 3: Product page shows its details and loaded product image', async ({ page }) => {
        // This test deliberately starts from the expected product URL, independently
        // from the search test above.
        await page.goto(`${siteUrl}${productLink}`, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/\/products\/detail\/texas-instruments\/lm358bidr\.html$/);

        await expect(page.getByRole('heading', { name: PART_NUMBER, exact: true })).toBeVisible();
        await expect(page.getByText('Part No', { exact: true })).toBeVisible();
        await expect(page.getByText(PART_NUMBER, { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Manufacturer', { exact: true }).first()).toBeVisible();
        await expect(page.getByRole('heading', { name: /Products specifications/i })).toBeVisible();
    });


});