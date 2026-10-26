import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { addAuditLog } from '@/src/server/db';
import {
  ensureGmailPriceOfferLabel,
  exchangeGmailAuthorizationCode,
  getGmailProfile,
  revokeGoogleRefreshToken,
} from '@/src/server/gmail-price-offer-api';
import {
  decryptGmailSecret,
  encryptGmailSecret,
  getGmailPriceOfferConfiguration,
  gmailPriceOfferLabelName,
} from '@/src/server/gmail-price-offer-config';
import { activateGmailPriceOfferConnection, consumeGmailOAuthState } from '@/src/server/gmail-price-offer-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminRedirect(siteUrl: string, status: string) {
  return NextResponse.redirect(new URL(`/admin/nastavenia?gmail=${encodeURIComponent(status)}`, siteUrl));
}

export async function GET(request: Request) {
  const admin = await requireSuperAdmin();
  const config = getGmailPriceOfferConfiguration();
  const baseUrl = config.siteUrl || new URL(request.url).origin;
  if (!config.configured || !config.encryptionKey) return adminRedirect(baseUrl, 'configuration');
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (url.searchParams.get('error')) return adminRedirect(baseUrl, 'cancelled');
  if (!state || !code) return adminRedirect(baseUrl, 'state');
  const encryptedVerifier = await consumeGmailOAuthState(state, admin.email);
  if (!encryptedVerifier) return adminRedirect(baseUrl, 'state');
  try {
    const verifier = decryptGmailSecret(encryptedVerifier, config.encryptionKey);
    const tokens = await exchangeGmailAuthorizationCode(code, verifier);
    const emailAddress = await getGmailProfile(tokens.accessToken);
    if (config.allowedAccountEmail && emailAddress !== config.allowedAccountEmail) {
      await revokeGoogleRefreshToken(tokens.refreshToken);
      return adminRedirect(baseUrl, 'account');
    }
    const labelId = await ensureGmailPriceOfferLabel(tokens.accessToken);
    await activateGmailPriceOfferConnection({
      emailAddress,
      encryptedRefreshToken: encryptGmailSecret(tokens.refreshToken, config.encryptionKey),
      labelId,
      labelName: gmailPriceOfferLabelName,
      actorEmail: admin.email,
    });
    await addAuditLog('system', randomUUID(), 'gmail_price_offer_connected', admin.email, {
      labelName: gmailPriceOfferLabelName,
    });
    return adminRedirect(baseUrl, 'ok');
  } catch (error) {
    console.error('Gmail price-offer connection failed.', { error: error instanceof Error ? error.name : 'unknown' });
    return adminRedirect(baseUrl, 'failed');
  }
}
