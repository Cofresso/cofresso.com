import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { createIsolatedDb } from '../src/lib/db/client';
import { runSeed } from '../src/lib/db/seed';

config({ path: ['.env.local', '.env'] });

type Command = 'migrate' | 'seed' | 'reset';

function connectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT = '5432', DB_SOCKET_DIR } = process.env;
  if (DB_USER && DB_PASSWORD && DB_NAME) {
    const creds = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}`;
    if (DB_SOCKET_DIR)
      return `postgres://${creds}@/${DB_NAME}?host=${encodeURIComponent(DB_SOCKET_DIR)}`;
    if (DB_HOST) return `postgres://${creds}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
  throw new Error('No database configuration found (DATABASE_URL or DB_* variables).');
}

async function main() {
  const command = process.argv[2] as Command | undefined;
  if (!command || !['migrate', 'seed', 'reset'].includes(command)) {
    console.error('Usage: db <migrate|seed|reset>');
    process.exit(2);
  }

  const { db, close } = createIsolatedDb(connectionString());
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

  try {
    if (command === 'reset') {
      if (process.env.ALLOW_DB_RESET !== 'true') {
        throw new Error('Refusing to reset: set ALLOW_DB_RESET=true to confirm.');
      }
      console.log('Dropping schema public...');
      await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
      await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
      await db.execute(sql`CREATE SCHEMA public`);
    }

    if (command === 'migrate' || command === 'reset') {
      console.log(`Applying migrations from ${migrationsFolder}...`);
      await migrate(db, { migrationsFolder });
      console.log('Migrations applied.');
    }

    if (command === 'seed' || command === 'reset') {
      console.log('Seeding...');
      const summary = await runSeed(db);
      console.log('Seed complete:', JSON.stringify(summary));
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
