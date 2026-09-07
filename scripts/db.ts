import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { createIsolatedDb } from '../src/lib/db/client';
import { runSeed } from '../src/lib/db/seed';
import { resolveDbTarget } from '../src/lib/db/target';

config({ path: ['.env.local', '.env'] });

/**
 * `deploy` = migrate then seed in one process. Cloud Run jobs get it as their baked-in
 * `args` so CI never has to pass `--args` to `gcloud run jobs execute` (which is broken in
 * gcloud 548.x: it sends an unknown `priorityTier` field and fails client-side).
 */
const COMMANDS = ['migrate', 'seed', 'reset', 'deploy'] as const;
type Command = (typeof COMMANDS)[number];

const MIGRATING: readonly Command[] = ['migrate', 'reset', 'deploy'];
const SEEDING: readonly Command[] = ['seed', 'reset', 'deploy'];

function isCommand(value: string | undefined): value is Command {
  return COMMANDS.includes(value as Command);
}

async function main() {
  const command = process.argv[2];
  if (!isCommand(command)) {
    console.error(`Usage: db <${COMMANDS.join('|')}>`);
    process.exit(2);
  }

  const { db, close } = createIsolatedDb(resolveDbTarget(process.env));
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

    if (MIGRATING.includes(command)) {
      console.log(`Applying migrations from ${migrationsFolder}...`);
      await migrate(db, { migrationsFolder });
      console.log('Migrations applied.');
    }

    if (SEEDING.includes(command)) {
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
