import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import pkg from '../../../../package.json';
import { getDb } from '@/lib/db/client';
import { logger, traceFields } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function checkDatabase(timeoutMs = 2000): Promise<'up' | 'down'> {
  const timer = new Promise<'down'>((resolve) => setTimeout(() => resolve('down'), timeoutMs));
  const probe = getDb()
    .execute(sql`select 1`)
    .then(() => 'up' as const)
    .catch(() => 'down' as const);
  return Promise.race([probe, timer]);
}

export async function GET(request: Request) {
  const db = await checkDatabase();
  const body = {
    status: db === 'up' ? 'ok' : 'degraded',
    db,
    version: pkg.version,
    commit: process.env.GIT_SHA ?? 'dev',
    timestamp: new Date().toISOString(),
  };
  if (db !== 'up')
    logger.warn('health check degraded', { ...body, ...traceFields(request.headers) });
  return NextResponse.json(body, {
    status: db === 'up' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
