import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, ButtonLink } from './button';

describe('Button', () => {
  it('renders a primary button by default', () => {
    render(<Button>Add to cart</Button>);
    const btn = screen.getByRole('button', { name: 'Add to cart' });
    expect(btn.className).toContain('bg-espresso');
  });
  it('shows a busy state', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
  it('renders links with button styling', () => {
    render(
      <ButtonLink href="/shop" variant="outline">
        Shop
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'Shop' });
    expect(link).toHaveAttribute('href', '/shop');
    expect(link.className).toContain('border');
  });
});
