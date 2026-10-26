import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { createGmailPkcePair, gmailAuthorizationUrl } from '@/src/server/gmail-price-offer-api';
import { encryptGmailSecret, getGmailPriceOfferConfiguration } from '@/src/server/gmail-price-offer-config';
import { createGmailOAuthState } from '@/src/server/gmail-price-offer-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireSuperAdmin();
  const config = getGmailPriceOfferConfiguration();
  if (!config.configured || !config.encryptionKey) {
    return NextResponse.redirect(new URL('/admin/nastavenia?gmail=configuration', request.url));
  }
  const pkce = createGmailPkcePair();
  const state = await createGmailOAuthState(admin.email, encryptGmailSecret(pkce.verifier, config.encryptionKey));
  return NextResponse.redirect(gmailAuthorizationUrl(state, pkce.challenge));
}
