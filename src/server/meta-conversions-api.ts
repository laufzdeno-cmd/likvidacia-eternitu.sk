import { createHash } from 'node:crypto';
import {
  claimMetaCapiOutboxEvents,
  getMetaCapiOutboxHealth,
  prepareClaimedMetaCapiEvent,
  settleClaimedMetaCapiEvent,
} from './db';
import type { MetaCapiDeliveryOutcome, MetaCapiDispatchInput } from './types';

type MetaCapiConfig = {
  pixelId: string;
  accessToken: string;
  apiVersion: string;
};

type MetaCapiFetch = typeof fetch;

function readMetaCapiConfig(): MetaCapiConfig | null {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim() || '';
  const apiVersion = process.env.META_GRAPH_API_VERSION?.trim() || '';
  const conversionEventSecret = process.env.CONVERSION_EVENT_SECRET?.trim() || '';
  if (!/^\d{5,32}$/.test(pixelId) || !accessToken || !/^v\d+\.\d+$/.test(apiVersion) || !conversionEventSecret) return null;
  return { pixelId, accessToken, apiVersion };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `421${digits.slice(1)}`;
  return digits;
}

async function providerErrorCode(
  response: Response,
  kind: 'rejected' | 'unavailable',
): Promise<MetaCapiDeliveryOutcome['errorCode']> {
  try {
    const text = await response.text();
    if (!text || text.length > 16_384) return `provider_${kind}`;
    const body = JSON.parse(text) as { error?: { code?: unknown; error_subcode?: unknown } };
    const code = Number(body.error?.code);
    const subcode = Number(body.error?.error_subcode);
    if (!Number.isInteger(code) || code < 0 || code > 2_147_483_647) return `provider_${kind}`;
    return Number.isInteger(subcode) && subcode >= 0 && subcode <= 2_147_483_647
      ? `meta_${kind}_${code}_${subcode}` as MetaCapiDeliveryOutcome['errorCode']
      : `meta_${kind}_${code}` as MetaCapiDeliveryOutcome['errorCode'];
  } catch {
    return `provider_${kind}`;
  }
}

async function metaAcceptedAtLeastOneEvent(response: Response) {
  try {
    const text = await response.text();
    if (!text || text.length > 16_384) return false;
    const body = JSON.parse(text) as { events_received?: unknown };
    return typeof body.events_received === 'number'
      && Number.isFinite(body.events_received)
      && body.events_received > 0;
  } catch {
    return false;
  }
}

export function isMetaCapiConfigured() {
  return Boolean(readMetaCapiConfig());
}

export async function sendMetaLeadEvent(
  input: MetaCapiDispatchInput,
  options: { fetchImpl?: MetaCapiFetch; timeoutMs?: number } = {},
): Promise<MetaCapiDeliveryOutcome> {
  const config = readMetaCapiConfig();
  if (!config) return { status: 'failed', retryable: false, errorCode: 'invalid_event' };
  const eventTime = Math.floor(Date.parse(input.eventTime) / 1000);
  if (!Number.isFinite(eventTime) || !/^lead:[a-f0-9]{64}$/.test(input.eventId)) {
    return { status: 'failed', retryable: false, errorCode: 'invalid_event' };
  }

  const email = input.email.trim().toLocaleLowerCase('sk-SK');
  const phone = normalizedPhone(input.phone);
  const userData: Record<string, unknown> = {};
  if (email) userData.em = [sha256(email)];
  if (phone) userData.ph = [sha256(phone)];
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent.slice(0, 512);
  if (!Object.keys(userData).length) return { status: 'failed', retryable: false, errorCode: 'invalid_event' };

  const payload = {
    data: [{
      event_name: 'Lead',
      event_time: eventTime,
      event_id: input.eventId,
      action_source: 'website',
      event_source_url: input.eventSourceUrl,
      user_data: userData,
      custom_data: { content_name: 'Nezáväzný dopyt', material: input.material },
    }],
    access_token: config.accessToken,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(options.timeoutMs ?? 4_000, 250), 10_000));
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(config.pixelId)}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    if (response.ok) {
      return await metaAcceptedAtLeastOneEvent(response)
        ? { status: 'sent', httpStatus: response.status, retryable: false }
        : { status: 'unknown', httpStatus: response.status, retryable: true, errorCode: 'provider_unavailable' };
    }
    if (response.status === 429 || response.status >= 500) {
      return { status: 'failed', httpStatus: response.status, retryable: true, errorCode: await providerErrorCode(response, 'unavailable') };
    }
    return { status: 'failed', httpStatus: response.status, retryable: false, errorCode: await providerErrorCode(response, 'rejected') };
  } catch {
    return { status: 'unknown', retryable: true, errorCode: 'transport_unknown' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchMetaCapiOutbox(options: {
  limit?: number;
  at?: Date;
  sender?: (input: MetaCapiDispatchInput) => Promise<MetaCapiDeliveryOutcome>;
} = {}) {
  if (!isMetaCapiConfigured()) {
    return { configured: false, claimed: 0, sent: 0, failed: 0, unknown: 0, cancelled: 0, health: await getMetaCapiOutboxHealth() };
  }
  const claims = await claimMetaCapiOutboxEvents(options.limit ?? 10, options.at);
  const sender = options.sender ?? ((input: MetaCapiDispatchInput) => sendMetaLeadEvent(input));
  const totals = { sent: 0, failed: 0, unknown: 0, cancelled: 0 };
  for (const claim of claims) {
    const input = await prepareClaimedMetaCapiEvent(claim, options.at);
    if (!input) {
      totals.cancelled += 1;
      continue;
    }
    let outcome: MetaCapiDeliveryOutcome;
    try {
      outcome = await sender(input);
    } catch {
      outcome = { status: 'unknown', retryable: true, errorCode: 'transport_unknown' };
    }
    const status = await settleClaimedMetaCapiEvent(claim, outcome, options.at);
    if (status && status in totals) totals[status as keyof typeof totals] += 1;
  }
  return { configured: true, claimed: claims.length, ...totals, health: await getMetaCapiOutboxHealth() };
}
