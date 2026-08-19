import { expect, test } from '@playwright/test';

const PART_NUMBER = 'LM358BIDR';

test.describe('WIN SOURCE product search', () => {
  test('finds a product and displays its details', async ({ page }) => {
    await page.goto('https://www.win-source.net/', {
      waitUntil: 'domcontentloaded',
    });

    // The site labels its main product search input "Search Parts".
    const searchBox = page.getByPlaceholder('Search Parts').first();
    await expect(searchBox).toBeVisible();
    await searchBox.fill(PART_NUMBER);
    await searchBox.press('Enter');

    // Search results can take a moment to render.  Select the matching product
    // link specifically, so navigation is not affected by menu/footer links.
    const targetPartNumber = PART_NUMBER.trim();
    const firstMatchingProduct = page
      .locator('a[href*="/products/detail/"]')
      .filter({ hasText: PART_NUMBER })
      .first();

    await expect(firstMatchingProduct).toBeVisible({ timeout: 20_000 });
    await expect(firstMatchingProduct).toContainText(PART_NUMBER);

    await Promise.all([
      page.waitForURL(/\/products\/detail\//),
      firstMatchingProduct.click(),
    ]);

    // Confirm this is the selected product, then check key product details.
    await expect(
      page.getByRole('heading', { name: PART_NUMBER, exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Part No', { exact: true })).toBeVisible();
    await expect(page.getByText('Manufacturer', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Description', { exact: true }).first()).toBeVisible();
    await expect(page.locator('body')).toContainText('Texas Instruments');
  });
});
