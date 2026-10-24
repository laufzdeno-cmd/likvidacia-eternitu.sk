import { createHmac } from 'node:crypto';
import { getFacebookMessengerConfiguration } from './facebook-messenger-config';

type FacebookGraphError = { error?: { message?: string; type?: string; code?: number; error_subcode?: number } };

function graphBase(version: string) {
  return `https://graph.facebook.com/${version}`;
}
function appSecretProof(accessToken: string, appSecret: string) {
  return createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

async function graphRequest<T>(url: URL, init: RequestInit, accessToken?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
    const response = await fetch(url, { ...init, headers, signal: controller.signal, cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as T & FacebookGraphError;
    if (!response.ok || payload.error) {
      const error = new Error(payload.error?.message || `Meta API odmietlo požiadavku (${response.status}).`) as Error & { code?: number; subcode?: number; httpStatus?: number };
      error.code = payload.error?.code;
      error.subcode = payload.error?.error_subcode;
      error.httpStatus = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function exchangeFacebookOAuthCode(code: string) {
  const config = getFacebookMessengerConfiguration();
  if (!config.configured) throw new Error('Facebook integrácia nie je úplná.');
  const url = new URL(`${graphBase(config.graphVersion)}/oauth/access_token`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('client_secret', config.appSecret);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('code', code);
  const result = await graphRequest<{ access_token?: string }>(url, { method: 'GET' });
  if (!result.access_token) throw new Error('Meta nevrátila používateľský prístupový token.');
  return result.access_token;
}

export async function getFacebookManagedPage(userAccessToken: string, expectedPageId: string) {
  const config = getFacebookMessengerConfiguration();
  const url = new URL(`${graphBase(config.graphVersion)}/me/accounts`);
  url.searchParams.set('fields', 'id,name,access_token,tasks');
  url.searchParams.set('limit', '100');
  url.searchParams.set('appsecret_proof', appSecretProof(userAccessToken, config.appSecret));
  const result = await graphRequest<{ data?: Array<{ id?: string; name?: string; access_token?: string; tasks?: string[] }> }>(
    url,
    { method: 'GET' },
    userAccessToken,
  );
  const page = result.data?.find((item) => item.id === expectedPageId);
  if (!page?.id || !page.name || !page.access_token) {
    throw new Error('V prihlásenom Meta účte sa nenašla očakávaná firemná stránka s oprávnením na správy.');
  }
  if (!page.tasks?.includes('MESSAGING')) {
    throw new Error('Prihlásený Meta účet nemá na očakávanej firemnej stránke oprávnenie na správy.');
  }
  return { id: page.id, name: page.name, accessToken: page.access_token, tasks: page.tasks ?? [] };
}

export async function subscribeFacebookPage(pageId: string, pageAccessToken: string) {
  const config = getFacebookMessengerConfiguration();
  const url = new URL(`${graphBase(config.graphVersion)}/${encodeURIComponent(pageId)}/subscribed_apps`);
  url.searchParams.set('subscribed_fields', 'messages,messaging_postbacks,message_deliveries,message_reads');
  url.searchParams.set('appsecret_proof', appSecretProof(pageAccessToken, config.appSecret));
  const result = await graphRequest<{ success?: boolean }>(url, { method: 'POST' }, pageAccessToken);
  if (result.success !== true) throw new Error('Meta nepotvrdila prihlásenie webhooku pre firemnú stránku.');
}

export async function unsubscribeFacebookPage(pageId: string, pageAccessToken: string) {
  const config = getFacebookMessengerConfiguration();
  const url = new URL(`${graphBase(config.graphVersion)}/${encodeURIComponent(pageId)}/subscribed_apps`);
  url.searchParams.set('appsecret_proof', appSecretProof(pageAccessToken, config.appSecret));
  return graphRequest<{ success?: boolean }>(url, { method: 'DELETE' }, pageAccessToken);
}

export async function fetchFacebookParticipantName(participantId: string, pageAccessToken: string) {
  const config = getFacebookMessengerConfiguration();
  const url = new URL(`${graphBase(config.graphVersion)}/${encodeURIComponent(participantId)}`);
  url.searchParams.set('fields', 'first_name,last_name');
  url.searchParams.set('appsecret_proof', appSecretProof(pageAccessToken, config.appSecret));
  const result = await graphRequest<{ first_name?: string; last_name?: string }>(url, { method: 'GET' }, pageAccessToken);
  return [result.first_name, result.last_name].filter(Boolean).join(' ').trim();
}

export type FacebookSendResult =
  | { status: 'sent'; providerMessageId: string }
  | { status: 'failed'; errorCode: string }
  | { status: 'unknown'; errorCode: string };

export async function sendFacebookTextMessage(input: {
  pageId: string;
  participantId: string;
  text: string;
  pageAccessToken: string;
}): Promise<FacebookSendResult> {
  const config = getFacebookMessengerConfiguration();
  const url = new URL(`${graphBase(config.graphVersion)}/${encodeURIComponent(input.pageId)}/messages`);
  url.searchParams.set('appsecret_proof', appSecretProof(input.pageAccessToken, config.appSecret));
  try {
    const result = await graphRequest<{ message_id?: string }>(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: input.participantId },
        messaging_type: 'RESPONSE',
        message: { text: input.text },
      }),
    }, input.pageAccessToken);
    return result.message_id
      ? { status: 'sent', providerMessageId: result.message_id }
      : { status: 'unknown', errorCode: 'meta_missing_message_id' };
  } catch (error) {
    const item = error as Error & { code?: number; subcode?: number; httpStatus?: number };
    if (item.name === 'AbortError' || !item.httpStatus || item.httpStatus >= 500 || item.httpStatus === 429) {
      return { status: 'unknown', errorCode: item.name === 'AbortError' ? 'meta_timeout' : `meta_transport_${item.httpStatus || 'unknown'}` };
    }
    return { status: 'failed', errorCode: `meta_rejected_${item.code || item.httpStatus}${item.subcode ? `_${item.subcode}` : ''}` };
  }
}
