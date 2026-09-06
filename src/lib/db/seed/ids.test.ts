import { describe, expect, it } from 'vitest';
import { stableId } from './ids';

describe('stableId', () => {
  it('is deterministic and uuid-shaped', () => {
    expect(stableId('product:morning-frame')).toBe(stableId('product:morning-frame'));
    expect(stableId('product:morning-frame')).toMatch(/^[0-9a-f-]{36}$/);
    expect(stableId('a')).not.toBe(stableId('b'));
  });
});
