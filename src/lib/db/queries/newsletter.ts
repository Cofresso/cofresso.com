import { getDb, type Db } from '@/lib/db/client';
import { newsletterSubscribers } from '@/lib/db/schema';

export async function subscribeToNewsletter(
  email: string,
  source: string,
  db: Db = getDb(),
): Promise<{ created: boolean }> {
  const rows = await db
    .insert(newsletterSubscribers)
    .values({ email: email.trim().toLowerCase(), source })
    .onConflictDoNothing({ target: newsletterSubscribers.email })
    .returning({ id: newsletterSubscribers.id });
  return { created: rows.length > 0 };
}
