import { afterAll, describe, expect, it } from 'vitest';
import { subscribeToNewsletter } from '../../src/lib/db/queries/newsletter';
import { testDb } from './helpers';

const { db, close } = testDb();
afterAll(() => close());

describe('subscribeToNewsletter', () => {
  it('creates once and is a no-op on repeat', async () => {
    const email = `test-${Date.now()}@example.com`;
    expect(await subscribeToNewsletter(email, 'test', db)).toEqual({ created: true });
    expect(await subscribeToNewsletter(email.toUpperCase(), 'test', db)).toEqual({
      created: false,
    });
  });
});
