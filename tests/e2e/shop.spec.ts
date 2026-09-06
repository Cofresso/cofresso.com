import { expect, test } from '@playwright/test';

test.describe('shop', () => {
  test('filters by roast and sorts by price', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByTestId('product-card')).toHaveCount(18);
    await page.getByTestId('filter-roast').selectOption('light');
    await expect(page).toHaveURL(/roast=light/);
    const cards = page.getByTestId('product-card');
    await expect(cards.first()).toBeVisible();
    await expect(page.getByTestId('result-count')).toContainText('3 products');
    for (const card of await cards.all()) await expect(card).toContainText('Light roast');

    await page.getByTestId('filter-roast').selectOption('');
    // The filters update via a client-side transition; wait for the roast param to actually
    // clear from the URL before changing sort, otherwise this select can fire while the
    // component still holds the stale (roast=light) filters and clobber it back in.
    await expect(page).not.toHaveURL(/roast=/);
    await page.getByTestId('filter-sort').selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page.getByTestId('product-card').first()).toHaveAttribute(
      'data-slug',
      'paper-filters',
    );
  });

  test('collection pages and search work', async ({ page }) => {
    await page.goto('/collections/equipment');
    await expect(page.getByTestId('collection-title')).toHaveText('Equipment');
    await expect(page.getByTestId('product-card')).toHaveCount(6);

    await page.goto('/search?q=yirgacheffe');
    await expect(page.getByTestId('search-count')).toContainText('1 result');
    await expect(page.getByTestId('product-card')).toHaveAttribute(
      'data-slug',
      'ethiopia-yirgacheffe',
    );

    await page.goto('/search?q=zzzz');
    await expect(page.getByTestId('empty-grid')).toBeVisible();
  });
});
