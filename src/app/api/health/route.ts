import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.1.0',
    commit: process.env.GIT_SHA ?? 'dev',
    timestamp: new Date().toISOString(),
  });
}
