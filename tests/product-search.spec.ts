import { expect, test } from '@playwright/test';

const PART_NUMBER = 'LM358BIDR';

test.describe('WIN SOURCE product search', () => {
  // Reuse the logged-in session saved by `npm run generate-auth`, since
  // anonymous searches are now redirected to the login page.
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('finds a product and displays its details', async ({ page }) => {
    await page.goto('/', {
      waitUntil: 'domcontentloaded',
    });

    // The site labels its main product search input "Search Parts".
    const searchBox = page.getByPlaceholder('Search Parts').first();
    await expect(searchBox).toBeVisible();
    await searchBox.fill(PART_NUMBER);

    // A search that matches exactly one part number now redirects straight to
    // that product's detail page — there is no intermediate results list to
    // click through, so wait for the detail-page URL instead of a list link.
    await Promise.all([
      page.waitForURL(/\/products\/detail\//, { timeout: 20_000 }),
      searchBox.press('Enter'),
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
