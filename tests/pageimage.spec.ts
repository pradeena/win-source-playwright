
import { expect, test } from '@playwright/test';

const PRODUCT_URL =
  'https://www.win-source.net/products/detail/texas-instruments/lm358bidr.html';
const PART_NUMBER = 'LM358BIDR';

test.describe('WIN SOURCE product detail page', () => {
  test('loads the product image correctly', async ({ page }) => {
    await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/products\/detail\//);
    await expect(
      page.getByRole('heading', { name: PART_NUMBER, exact: true }),
    ).toBeVisible();

    // This is the product-photo carousel image, rather than a logo or icon.
    const productImage = page
      .getByAltText(new RegExp(`${PART_NUMBER} Real Image`, 'i'))
      .first();

    await productImage.scrollIntoViewIfNeeded();
    await expect(productImage).toBeVisible();
    await expect(productImage).toHaveAttribute('src', /\S+/);

    // `naturalWidth` is zero for a broken image, even when its <img> tag exists.
    await expect
      .poll(() => productImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  });
});
