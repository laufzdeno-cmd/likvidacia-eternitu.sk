import { NextResponse } from 'next/server';
import { clearAdminSession } from '@/src/server/auth';

export async function POST(request: Request) {
  await clearAdminSession();
  return NextResponse.redirect(new URL('/admin/login', request.url), { status: 303 });
}
