import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Price } from './price';

describe('Price', () => {
  it('formats cents', () => {
    render(<Price cents={1800} />);
    expect(screen.getByText('$18.00')).toBeInTheDocument();
  });
  it('shows a struck-through compare-at price when higher', () => {
    render(<Price cents={6400} compareAtCents={6800} />);
    expect(screen.getByText('$68.00')).toHaveClass('line-through');
  });
});
