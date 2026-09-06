import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names and resolves tailwind conflicts', () => {
    expect(cn('p-2', 'p-4', undefined, false && 'hidden', 'text-espresso')).toBe(
      'p-4 text-espresso',
    );
  });
});
