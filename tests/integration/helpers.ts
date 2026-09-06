import { config } from 'dotenv';
import { createIsolatedDb } from '../../src/lib/db/client';

config({ path: ['.env.local', '.env'] });

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://cofresso:cofresso@localhost:5432/cofresso_test';

export function testDb() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  return createIsolatedDb(TEST_DATABASE_URL);
}
