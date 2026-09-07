import { expect, test } from '@playwright/test';
import { addToCart, closeDrawer } from './helpers';

test.describe('product and cart', () => {
  test('variant and subscription change the price, add to cart opens the drawer', async ({
    page,
  }) => {
    await page.goto('/products/morning-frame');
    await expect(page.getByTestId('product-title')).toHaveText('Morning Frame');
    await expect(page.getByTestId('selected-price')).toHaveText('$18.00');
    await page.getByRole('radio', { name: /2 lb/ }).click();
    await expect(page.getByTestId('selected-price')).toHaveText('$44.10');
    await page.getByRole('radio', { name: /subscribe/i }).click();
    await expect(page.getByTestId('selected-price')).toHaveText('$37.49');
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();
    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await expect(page.getByTestId('cart-drawer').getByTestId('cart-line')).toContainText(
      'Subscription',
    );
  });

  test('promo codes and the free shipping bar', async ({ page }) => {
    await addToCart(page, 'cofresso-mug');
    await closeDrawer(page);
    await page.goto('/cart');
    await expect(page.getByTestId('free-shipping-bar')).toHaveAttribute('data-unlocked', 'false');
    await expect(page.getByTestId('summary-shipping')).toHaveText('$6.00');

    await page.getByTestId('promo-form').getByRole('textbox').fill('welcome10');
    await page.getByTestId('promo-form').getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('promo-applied')).toContainText('WELCOME10');
    await expect(page.getByTestId('summary-discount')).toHaveText('−$2.40');

    await addToCart(page, 'gooseneck-kettle');
    await closeDrawer(page);
    await page.goto('/cart');
    await expect(page.getByTestId('free-shipping-bar')).toHaveAttribute('data-unlocked', 'true');
    await expect(page.getByTestId('summary-shipping')).toHaveText('Free');

    const lines = page.getByTestId('cart-line');
    await expect(lines).toHaveCount(2);
    await lines.first().getByRole('button', { name: 'Remove' }).click();
    await expect(lines).toHaveCount(1);
    await lines.first().getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByTestId('empty-cart')).toBeVisible();
  });
});
