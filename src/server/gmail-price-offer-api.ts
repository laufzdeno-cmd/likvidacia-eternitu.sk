import { createHash, randomBytes } from 'node:crypto';
import {
  getGmailPriceOfferConfiguration,
  gmailPriceOfferLabelName,
  gmailPriceOfferScope,
} from './gmail-price-offer-config';
import { gmailMessageSearchQuery } from './gmail-price-offer-policy';

type GoogleOAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
};

type GmailLabel = { id?: string; name?: string; type?: string };

export class GmailPriceOfferApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'GmailPriceOfferApiError';
  }
}

async function fetchWithTimeout(input: string | URL, init: RequestInit = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GmailPriceOfferApiError('google_timeout', true);
    }
    throw new GmailPriceOfferApiError('google_network_error', true);
  } finally {
    clearTimeout(timeout);
  }
}

export function createGmailPkcePair() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function gmailAuthorizationUrl(state: string, challenge: string) {
  const config = getGmailPriceOfferConfiguration();
  if (!config.configured) throw new GmailPriceOfferApiError('gmail_not_configured', false);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', gmailPriceOfferScope);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url;
}

async function tokenRequest(parameters: Record<string, string>) {
  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parameters),
  });
  const payload = await response.json().catch(() => ({})) as GoogleOAuthTokenResponse;
  if (!response.ok || !payload.access_token) {
    const invalidGrant = payload.error === 'invalid_grant';
    throw new GmailPriceOfferApiError(invalidGrant ? 'oauth_reauthorization_required' : 'oauth_token_failed', !invalidGrant && response.status >= 500);
  }
  return payload;
}

export async function exchangeGmailAuthorizationCode(code: string, codeVerifier: string) {
  const config = getGmailPriceOfferConfiguration();
  if (!config.configured) throw new GmailPriceOfferApiError('gmail_not_configured', false);
  const tokens = await tokenRequest({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });
  if (!tokens.refresh_token) throw new GmailPriceOfferApiError('oauth_refresh_token_missing', false);
  return { accessToken: tokens.access_token!, refreshToken: tokens.refresh_token };
}

export async function refreshGmailAccessToken(refreshToken: string) {
  const config = getGmailPriceOfferConfiguration();
  if (!config.configured) throw new GmailPriceOfferApiError('gmail_not_configured', false);
  const tokens = await tokenRequest({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return tokens.access_token!;
}

async function gmailRequest<T>(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetchWithTimeout(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: { status?: string } };
  if (!response.ok) {
    const status = payload.error?.status || '';
    if (response.status === 401 || response.status === 403) throw new GmailPriceOfferApiError('gmail_authorization_failed', false);
    if (response.status === 429) throw new GmailPriceOfferApiError('gmail_rate_limited', true);
    throw new GmailPriceOfferApiError(status ? `gmail_${status.toLowerCase()}` : `gmail_http_${response.status}`, response.status >= 500);
  }
  return payload;
}

export async function getGmailProfile(accessToken: string) {
  const profile = await gmailRequest<{ emailAddress?: string }>(accessToken, '/profile');
  const emailAddress = String(profile.emailAddress || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) throw new GmailPriceOfferApiError('gmail_profile_invalid', false);
  return emailAddress;
}

export async function ensureGmailPriceOfferLabel(accessToken: string) {
  const listing = await gmailRequest<{ labels?: GmailLabel[] }>(accessToken, '/labels');
  const existing = (listing.labels || []).find((label) => label.type === 'user' && label.name === gmailPriceOfferLabelName);
  if (existing?.id) {
    await gmailRequest(accessToken, `/labels/${encodeURIComponent(existing.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        color: { textColor: '#ffffff', backgroundColor: '#16a766' },
        messageListVisibility: 'show',
        labelListVisibility: 'labelShow',
      }),
    });
    return existing.id;
  }
  const created = await gmailRequest<GmailLabel>(accessToken, '/labels', {
    method: 'POST',
    body: JSON.stringify({
      name: gmailPriceOfferLabelName,
      color: { textColor: '#ffffff', backgroundColor: '#16a766' },
      messageListVisibility: 'show',
      labelListVisibility: 'labelShow',
    }),
  });
  if (!created.id) throw new GmailPriceOfferApiError('gmail_label_create_failed', false);
  return created.id;
}

export async function findExactSentGmailMessage(accessToken: string, rfc822MessageId: string) {
  const query = gmailMessageSearchQuery(rfc822MessageId);
  const params = new URLSearchParams({ q: query, maxResults: '5', includeSpamTrash: 'false' });
  const result = await gmailRequest<{ messages?: Array<{ id?: string }> }>(accessToken, `/messages?${params}`);
  const ids = (result.messages || []).map((item) => String(item.id || '')).filter(Boolean);
  if (ids.length === 0) return { status: 'not_found' as const };
  const details = await Promise.all(ids.map((id) => gmailRequest<{ id?: string; labelIds?: string[] }>(
    accessToken,
    `/messages/${encodeURIComponent(id)}?format=minimal&fields=id%2ClabelIds`,
  )));
  const sent = details.filter((message) => message.id && message.labelIds?.includes('SENT'));
  if (sent.length === 1) return { status: 'found' as const, messageId: String(sent[0].id) };
  if (sent.length === 0) return { status: 'not_found' as const };
  return { status: 'ambiguous' as const };
}

export async function markGmailMessageAsSentPriceOffer(accessToken: string, messageId: string, labelId: string) {
  await gmailRequest(accessToken, `/messages/${encodeURIComponent(messageId)}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds: [labelId, 'STARRED'], removeLabelIds: [] }),
  });
}

export async function revokeGoogleRefreshToken(refreshToken: string) {
  try {
    await fetchWithTimeout('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch {
    // Local disconnection remains authoritative even when Google is temporarily unavailable.
  }
}
