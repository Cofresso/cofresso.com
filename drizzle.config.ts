import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: ['.env.local', '.env'] });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://cofresso:cofresso@localhost:5432/cofresso',
  },
  strict: true,
  verbose: true,
});
