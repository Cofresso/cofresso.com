import { expect, test } from '@playwright/test';
import { dismissInterruptions } from './helpers';

test.describe('home', () => {
  test('renders hero, featured products and navigates to the shop', async ({ page }) => {
    await page.goto('/');
    await dismissInterruptions(page);
    await expect(page.getByTestId('hero')).toBeVisible();
    await expect(page.getByTestId('product-card')).toHaveCount(4);
    await expect(page.getByTestId('collection-grid').getByRole('link')).toHaveCount(4);
    await page.getByTestId('hero-cta').click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('footer carries the easter egg', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('easter-egg-link')).toHaveAttribute(
      'href',
      'https://github.com/coframe/coffee',
    );
  });

  test('newsletter signup succeeds', async ({ page }) => {
    await page.goto('/');
    await dismissInterruptions(page);
    const form = page.getByTestId('newsletter-form');
    await form.getByRole('textbox').fill(`e2e-${Date.now()}@example.com`);
    await form.getByRole('button').click();
    await expect(page.getByTestId('newsletter-success')).toBeVisible();
  });
});
