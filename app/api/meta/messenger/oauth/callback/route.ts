import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { exchangeFacebookOAuthCode, getFacebookManagedPage, subscribeFacebookPage } from '@/src/server/facebook-messenger-api';
import { encryptFacebookPageToken, getFacebookMessengerConfiguration } from '@/src/server/facebook-messenger-config';
import { activateFacebookPageConnection, consumeFacebookOAuthState } from '@/src/server/facebook-messenger-db';
import { addAuditLog } from '@/src/server/db';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminRedirect(siteUrl: string, status: string) {
  return NextResponse.redirect(new URL(`/admin/facebook?connect=${encodeURIComponent(status)}`, siteUrl));
}
export async function GET(request: Request) {
  const admin = await requireSuperAdmin();
  const config = getFacebookMessengerConfiguration();
  const adminBaseUrl = config.siteUrl || new URL(request.url).origin;
  if (!config.configured || !config.encryptionKey) return adminRedirect(adminBaseUrl, 'configuration');
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (!state || !code || !(await consumeFacebookOAuthState(state, admin.email))) return adminRedirect(adminBaseUrl, 'state');
  try {
    const userAccessToken = await exchangeFacebookOAuthCode(code);
    const page = await getFacebookManagedPage(userAccessToken, config.pageId);
    await subscribeFacebookPage(page.id, page.accessToken);
    await activateFacebookPageConnection({
      pageId: page.id,
      pageName: page.name,
      encryptedPageAccessToken: encryptFacebookPageToken(page.accessToken, config.encryptionKey),
      appId: config.appId,
      graphVersion: config.graphVersion,
      actorEmail: admin.email,
    });
    await addAuditLog('system', randomUUID(), 'facebook_page_connected', admin.email, { pageId: page.id, pageName: page.name });
    return adminRedirect(adminBaseUrl, 'ok');
  } catch (error) {
    console.error('Facebook Page connection failed.', error instanceof Error ? error.message : 'unknown_error');
    return adminRedirect(adminBaseUrl, 'failed');
  }
}
