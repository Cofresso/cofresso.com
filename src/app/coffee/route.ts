import { NextResponse } from 'next/server';
import { siteConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.redirect(siteConfig.easterEggUrl, 302);
}
