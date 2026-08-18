import { expect, test } from '@playwright/test';

const HOME_URL = 'https://www.win-source.net/';

test.describe('WIN SOURCE home page', () => {
  test('shows a loaded WIN SOURCE logo', async ({ page }) => {
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });

    // The site uses the logo image as its home-page link in the header.
    const logo = page
      .locator('header a[href="/"], header a[href="https://www.win-source.net/"]')
      .locator('img')
      .first();

    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', /\S+/);

    // A present <img> can still be broken; a positive naturalWidth proves it loaded.
    await expect
      .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  });
});
