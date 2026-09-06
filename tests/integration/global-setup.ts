import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { createIsolatedDb } from '../../src/lib/db/client';
import { runSeed } from '../../src/lib/db/seed';

config({ path: ['.env.local', '.env'] });

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://cofresso:cofresso@localhost:5432/cofresso_test';

export default async function setup() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { db, close } = createIsolatedDb(TEST_DATABASE_URL);
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    await runSeed(db);
  } finally {
    await close();
  }
}
