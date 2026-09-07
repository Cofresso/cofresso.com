import { expect, test, type Page } from '@playwright/test';
import { addToCart, closeDrawer, TEST_CARD_DECLINED, TEST_CARD_OK } from './helpers';

async function fillCheckout(page: Page, card: string, email: string) {
  await page.goto('/checkout');
  await page.getByLabel('Email').fill(email);
  await page.getByTestId('continue-contact').click();
  await page.getByLabel('Full name').fill('Ada Lovelace');
  await page.getByLabel('Address', { exact: true }).fill('1 Analytical Way');
  await page.getByLabel('City').fill('San Francisco');
  await page.getByLabel('State').fill('CA');
  await page.getByLabel('ZIP / Postal code').fill('94110');
  await page.getByTestId('continue-shipping').click();
  await page.getByLabel('Card number').fill(card);
  await page.getByLabel('Name on card').fill('Ada Lovelace');
  await page.getByLabel('CVC').fill('123');
  await page.getByTestId('continue-payment').click();
  await page.getByTestId('place-order').click();
}

test.describe('checkout', () => {
  test('redirects an empty cart back to the cart page', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/cart$/);
  });

  test('places an order and can look it up', async ({ page }) => {
    const email = `buyer-${Date.now()}@example.com`;
    await addToCart(page, 'brew-scale');
    await closeDrawer(page);
    await fillCheckout(page, TEST_CARD_OK, email);

    await expect(page).toHaveURL(/\/checkout\/success\/CF-\d+\?t=/);
    await expect(page.getByTestId('success-title')).toContainText('Ada');
    const orderNumber = (await page.getByTestId('order-number').textContent())!.trim();
    expect(orderNumber).toMatch(/^CF-\d{5,}$/);
    await expect(page.getByTestId('order-total')).toHaveText('$48.60');
    await expect(page.getByTestId('cart-count')).toHaveCount(0);

    await page.goto('/orders');
    await page.getByLabel('Order number').fill(orderNumber);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Find my order' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderNumber}\\?t=`));
    await expect(page.getByTestId('order-number')).toHaveText(orderNumber);

    await page.goto('/orders');
    await page.getByLabel('Order number').fill(orderNumber);
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByRole('button', { name: 'Find my order' }).click();
    await expect(page.getByTestId('lookup-error')).toBeVisible();
  });

  test('shows a decline and keeps the cart', async ({ page }) => {
    await addToCart(page, 'paper-filters');
    await closeDrawer(page);
    await fillCheckout(page, TEST_CARD_DECLINED, `decline-${Date.now()}@example.com`);
    await expect(page.getByTestId('checkout-error')).toContainText('declined');
    await expect(page.getByTestId('step-payment')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });
});
