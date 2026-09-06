import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Product, ProductVariant } from '@/lib/db/schema';
import { CartDrawerProvider } from '@/components/layout/cart-drawer-context';
import { AddToCartForm } from './add-to-cart-form';

vi.mock('@/lib/cart/actions', () => ({
  addToCartAction: vi.fn(async () => ({ ok: true, data: { itemCount: 1 } })),
}));

const product = {
  id: 'p1',
  slug: 'morning-frame',
  name: 'Morning Frame',
  category: 'coffee',
} as Product;

const variants: ProductVariant[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    productId: 'p1',
    sku: 'A',
    name: '12 oz',
    weightGrams: 340,
    priceCents: 1800,
    compareAtPriceCents: null,
    stockQuantity: 10,
    position: 0,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'p1',
    sku: 'B',
    name: '2 lb',
    weightGrams: 907,
    priceCents: 4400,
    compareAtPriceCents: null,
    stockQuantity: 0,
    position: 1,
  },
];

function renderForm() {
  return render(
    <CartDrawerProvider>
      <AddToCartForm product={product} variants={variants} />
    </CartDrawerProvider>,
  );
}

describe('AddToCartForm', () => {
  it('shows the selected variant price and subscription savings', async () => {
    renderForm();
    expect(screen.getByTestId('selected-price')).toHaveTextContent('$18.00');
    await userEvent.click(screen.getByRole('radio', { name: /subscribe/i }));
    expect(screen.getByTestId('selected-price')).toHaveTextContent('$15.30');
  });

  it('disables sold out variants', () => {
    renderForm();
    expect(screen.getByRole('radio', { name: /2 lb/i })).toBeDisabled();
  });

  it('changes quantity and keeps price per unit', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByTestId('selected-price')).toHaveTextContent('$18.00');
    expect(screen.getByRole('button', { name: /add to cart/i })).toHaveTextContent('$36.00');
  });
});
