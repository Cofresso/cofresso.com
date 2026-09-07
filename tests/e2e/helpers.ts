import { expect, type Page } from '@playwright/test';

/**
 * Clear the interruptions a real visitor has to get past before they can use the page: accept
 * the cookie banner, close the email-capture popup if it has already fired. Idempotent and a
 * no-op when nothing is showing (including when `UX_INTERRUPTIONS=off`), so specs can call it
 * after any navigation.
 */
export async function dismissInterruptions(page: Page) {
  // Popup first: it is a modal, so its overlay sits over the cookie banner and would
  // swallow a click aimed at it.
  const popup = page.getByTestId('popup');
  if (await popup.isVisible()) {
    await page.getByTestId('popup-dismiss').click();
    await expect(popup).toBeHidden();
  }
  const banner = page.getByTestId('cookie-banner');
  if (await banner.isVisible()) {
    await page.getByTestId('consent-accept').click();
    await expect(banner).toBeHidden();
  }
}

export async function addToCart(
  page: Page,
  slug: string,
  options: { size?: string; subscription?: boolean } = {},
) {
  await page.goto(`/products/${slug}`);
  await dismissInterruptions(page);
  if (options.size) await page.getByRole('radio', { name: new RegExp(options.size) }).click();
  if (options.subscription) await page.getByRole('radio', { name: /subscribe/i }).click();
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  await expect(page.getByTestId('cart-drawer').getByTestId('cart-line').first()).toBeVisible();
}

export async function closeDrawer(page: Page) {
  await page.getByTestId('cart-drawer').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('cart-drawer')).toBeHidden();
}

export const TEST_CARD_OK = '4242 4242 4242 4242';
export const TEST_CARD_DECLINED = '4000 0000 0000 0002';
