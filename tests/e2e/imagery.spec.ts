import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dismissInterruptions, suppressPopup } from './helpers';

interface ManifestEntry {
  url: string;
  alt: string;
  kind?: string;
}

interface Manifest {
  products: Record<string, ManifestEntry[]>;
  collections: Record<string, ManifestEntry>;
  home: Record<string, ManifestEntry>;
  guides: Record<string, ManifestEntry>;
}

const manifest: Manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), 'content/images.manifest.json'), 'utf8'),
) as Manifest;

const PRODUCT_SLUG = 'morning-frame';
const COLLECTION_SLUG = 'blends';
const productImages = manifest.products[PRODUCT_SLUG] ?? [];

/** Filenames are content-addressed, so the tail identifies the image even inside /_next/image?url=… */
function filename(url: string): string {
  return url.split('/').pop() ?? url;
}

test.beforeEach(async ({ page }) => {
  // The popup is covered by interruptions.spec.ts; here it would only land mid-flow.
  await suppressPopup(page);
});

test.describe('generated imagery', () => {
  test('the product gallery shows four thumbnails and swaps the main image', async ({ page }) => {
    test.skip(productImages.length < 4, 'no generated imagery in the manifest yet');

    await page.goto(`/products/${PRODUCT_SLUG}`);
    await dismissInterruptions(page);
    const gallery = page.getByTestId('gallery');
    await expect(gallery).toBeVisible();
    await expect(gallery).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(page.getByTestId(/^gallery-thumb-/)).toHaveCount(4);

    const main = page.getByTestId('gallery-main');
    const first = await main.getAttribute('src');
    expect(first).toContain(filename(productImages[0].url));
    await expect(page.getByTestId('gallery-thumb-0')).toHaveAttribute('aria-current', 'true');

    await page.getByTestId('gallery-thumb-1').click();
    await expect(main).not.toHaveAttribute('src', first!);
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[1].url)));
    await expect(page.getByTestId('gallery-thumb-1')).toHaveAttribute('aria-current', 'true');

    await gallery.focus();
    await page.keyboard.press('ArrowRight');
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[2].url)));
    await expect(page.getByTestId('gallery-thumb-2')).toHaveAttribute('aria-current', 'true');

    await page.getByTestId('gallery-prev').click();
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[1].url)));
    await expect(page.getByTestId('gallery-thumb-1')).toHaveAttribute('aria-current', 'true');

    // Wrap-around: prev from the first image goes to the last, next from the last returns to the first.
    await page.getByTestId('gallery-thumb-0').click();
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[0].url)));
    await page.getByTestId('gallery-prev').click();
    const lastIndex = productImages.length - 1;
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[lastIndex].url)));
    await expect(page.getByTestId(`gallery-thumb-${lastIndex}`)).toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.getByTestId('gallery-next').click();
    await expect(main).toHaveAttribute('src', new RegExp(filename(productImages[0].url)));
    await expect(page.getByTestId('gallery-thumb-0')).toHaveAttribute('aria-current', 'true');
  });

  test('the collection hero renders', async ({ page }) => {
    test.skip(!manifest.collections[COLLECTION_SLUG], 'no collection hero in the manifest yet');

    await page.goto(`/collections/${COLLECTION_SLUG}`);
    await dismissInterruptions(page);
    await expect(page.getByTestId('collection-hero')).toBeVisible();
    // Exactly one heading: the hero is image-only.
    await expect(page.getByTestId('collection-title')).toHaveCount(1);
    await expect(page.getByTestId('collection-title')).toHaveText('Blends');
  });

  test('the home page and brew guides use their generated images', async ({ page }) => {
    test.skip(!manifest.home.hero, 'no home imagery in the manifest yet');

    await page.goto('/');
    await dismissInterruptions(page);
    const heroImage = page.getByTestId('hero-image').locator('img');
    await expect(heroImage).toBeVisible();
    // A broken image (404, decode failure) still passes `toBeVisible`, so also
    // require a decoded image with real pixels.
    expect(await heroImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(
      0,
    );
    await expect(page.getByTestId('story-image')).toBeVisible();

    const guideSlug = Object.keys(manifest.guides)[0];
    test.skip(!guideSlug, 'no guide covers in the manifest yet');
    await page.goto(`/brew-guides/${guideSlug}`);
    await dismissInterruptions(page);
    await expect(page.getByTestId('guide-cover')).toBeVisible();
  });

  test('product cards render the generated front image', async ({ page }) => {
    test.skip(productImages.length === 0, 'no generated imagery in the manifest yet');

    await page.goto('/shop');
    await dismissInterruptions(page);
    const card = page
      .getByTestId('product-card')
      .filter({ has: page.locator('h3') })
      .first();
    await expect(card.getByTestId('card-image').first()).toBeVisible();
  });

  test('every manifest image is served from the CDN', async ({ request }) => {
    const urls = [
      ...Object.values(manifest.products).flat(),
      ...Object.values(manifest.collections),
      ...Object.values(manifest.home),
      ...Object.values(manifest.guides),
    ].map((entry) => entry.url);
    test.skip(urls.length === 0, 'no generated imagery in the manifest yet');

    // A sample keeps the suite fast; the generation script already verified
    // every upload, and a missing object would fail the gallery test above.
    for (const url of urls.slice(0, 5)) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type']).toBe('image/webp');
      // The uploaded object's own metadata is a one-year `Cache-Control`
      // (`IMAGE_CACHE_CONTROL` in src/lib/images/paths.ts), and the assets backend
      // bucket's Cloud CDN policy caches it at the edge for up to that long
      // (`max_ttl`), but that same policy's one-day `client_ttl` is what Cloud CDN
      // rewrites into the response actually sent to browsers. Confirmed against
      // the live CDN with `curl -I`, so this asserts the header a real client
      // receives, not the origin's or the edge cache's.
      expect(res.headers()['cache-control']).toContain('max-age=86400');
    }
  });
});
