import { test, expect } from '@playwright/test';

test('has logo image', async ({ page }) => {
    await page.goto('https://win-source.net/');
    const productImage = page.getByAltText("Obsolete electronic parts, electronic components distributor Online Store");
    await expect(productImage).toBeVisible();
});
