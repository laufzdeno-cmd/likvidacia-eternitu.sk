import { NextResponse } from 'next/server';
import { clearAdminSession, verifyCsrf } from '@/src/server/auth';

export async function POST(request: Request) {
  await verifyCsrf(await request.formData());
  await clearAdminSession();
  return NextResponse.redirect(new URL('/admin/login', request.url), { status: 303 });
}
