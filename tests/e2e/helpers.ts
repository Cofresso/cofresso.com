import { expect, type Page } from '@playwright/test';

export async function addToCart(
  page: Page,
  slug: string,
  options: { size?: string; subscription?: boolean } = {},
) {
  await page.goto(`/products/${slug}`);
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
