import { devices, expect, test } from '@playwright/test';

// Only chromium is installed locally/in CI, so drop `defaultBrowserType: 'webkit'`
// from the preset and keep chromium with the iPhone 13 viewport/UA/touch emulation.
const { defaultBrowserType: _defaultBrowserType, ...iPhone13 } = devices['iPhone 13'];

test.describe('mobile nav', () => {
  test.use({ ...iPhone13 });

  test('opens a full-height drawer from the hamburger and closes on Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();

    const sheet = page.getByTestId('mobile-nav');
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(300);

    const shopLink = sheet.getByRole('link', { name: 'Shop' });
    await expect(shopLink).toBeVisible();
    // `trial: true` runs Playwright's actionability checks (visible, stable,
    // receives events) without performing the click, so we confirm the link
    // is actually clickable without navigating away and losing the open sheet.
    await shopLink.click({ trial: true });

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('also opens correctly from a second page', async ({ page }) => {
    await page.goto('/shop');
    await page.getByRole('button', { name: 'Open menu' }).click();

    const sheet = page.getByTestId('mobile-nav');
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(300);
    await expect(sheet.getByRole('link', { name: 'Shop' })).toBeVisible();
  });
});

test.describe('cart drawer (desktop)', () => {
  test('opens the empty-cart state from the cart button and closes via Close', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('cart-button').click();

    const drawer = page.getByTestId('cart-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('empty-cart')).toBeVisible();

    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toBeHidden();
  });
});
