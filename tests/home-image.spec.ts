import { expect, test, type Page } from '@playwright/test';

type ImageResult = { src: string; alt: string; width: number; height: number };

// Scroll down the page in steps so lazy-loaded images (loading="lazy" or
// JS-driven) are brought into view and start loading.
async function scrollThroughPage(page: Page) {
    await page.evaluate(async () => {
        const step = window.innerHeight;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        window.scrollTo(0, 0);
    });
}

// Visible <img> elements served by the site under test. Excluded, because they
// are never expected to render: hidden images, third-party tracking pixels,
// and carousel slides parked off-screen to the side (lazy images there never
// start loading because they never enter the viewport).
function findVisibleSiteImages() {
    return [...document.images]
        .filter(img => {
            const style = getComputedStyle(img);
            const rect = img.getBoundingClientRect();
            return (
                new URL(img.currentSrc || img.src, location.href).origin === location.origin &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.width > 0 &&
                rect.height > 0 &&
                rect.right > 0 &&
                rect.left < window.innerWidth
            );
        })
        .map(img => ({
            src: img.currentSrc || img.src,
            alt: img.alt || 'No alt text',
            complete: img.complete,
            width: img.naturalWidth,
            height: img.naturalHeight,
        }));
}

test.describe('WIN SOURCE Homepage Image Test', () => {
    test('should display all images correctly', async ({ page }) => {
        // The site keeps background requests (analytics, maps) running, so
        // "networkidle" never settles; wait for the load event instead.
        await page.goto('/', { waitUntil: 'load' });
        await scrollThroughPage(page);

        // Wait until every visible site image has finished loading (or failed).
        await expect
            .poll(async () => (await page.evaluate(findVisibleSiteImages)).every(img => img.complete), {
                message: 'images are still loading',
                timeout: 30_000,
            })
            .toBe(true);

        const images = await page.evaluate(findVisibleSiteImages);
        expect(images.length, 'expected the home page to show images').toBeGreaterThan(0);

        // A loaded image has non-zero natural dimensions; a broken one has 0x0.
        const broken: ImageResult[] = images
            .filter(img => img.width === 0 || img.height === 0)
            .map(({ src, alt, width, height }) => ({ src, alt, width, height }));

        console.log(`Checked ${images.length} visible images: ${images.length - broken.length} loaded, ${broken.length} broken.`);
        for (const img of broken) {
            console.log(`  - broken: ${img.src} (alt="${img.alt}")`);
        }

        expect(broken, `${broken.length} image(s) failed to load`).toEqual([]);
    });
});
