import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { getFacebookMessengerConfiguration } from '@/src/server/facebook-messenger-config';
import { createFacebookOAuthState } from '@/src/server/facebook-messenger-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireSuperAdmin();
  const config = getFacebookMessengerConfiguration();
  if (!config.configured) return NextResponse.redirect(new URL('/admin/facebook?connect=configuration', request.url));
  const state = await createFacebookOAuthState(admin.email);
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'pages_show_list,pages_messaging,pages_manage_metadata');
  return NextResponse.redirect(url);
}
