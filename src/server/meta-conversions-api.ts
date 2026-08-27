import 'server-only';

import { createHash } from 'node:crypto';
import {
  claimMetaCapiOutboxEvents,
  settleMetaCapiOutboxEvent,
  type MetaCapiOutboxDispatchItem,
} from './db';

export type MetaLeadMaterial = 'vlnity' | 'plocha' | 'iny' | 'neviem';

type MetaLeadEventInput = {
  eventId: string;
  eventTime: string;
  email: string;
  phone: string;
  material: MetaLeadMaterial;
  eventSourceUrl: string;
  clientIp?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
};

type MetaConfig = {
  pixelId: string;
  accessToken: string;
  apiVersion: string;
  testEventCode?: string;
};

type MetaUserData = {
  client_ip_address?: string;
  client_user_agent?: string;
  em?: string[];
  ph?: string[];
  fbp?: string;
  fbc?: string;
};

function config(): MetaConfig | null {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim() || '';
  const apiVersion = process.env.META_GRAPH_API_VERSION?.trim() || '';
  if (!pixelId || !accessToken || !/^v\d+\.\d+$/.test(apiVersion)) return null;
  return {
    pixelId,
    accessToken,
    apiVersion,
    testEventCode: process.env.META_CAPI_TEST_EVENT_CODE?.trim() || undefined,
  };
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

function normalizedMaterial(value: string): MetaLeadMaterial {
  const normalized = value.toLocaleLowerCase('sk-SK');
  if (normalized.includes('vlnit')) return 'vlnity';
  if (normalized.includes('ploch') || normalized.includes('hlad') || normalized.includes('kosoštvor')) return 'plocha';
  if (normalized.includes('neviem')) return 'neviem';
  return 'iny';
}

export function isMetaCapiConfigured() {
  return Boolean(config());
}

export function metaMaterialFromLeadValue(value: string) {
  return normalizedMaterial(value);
}

export async function sendMetaLeadEvent(input: MetaLeadEventInput) {
  const settings = config();
  if (!settings) return { attempted: false, sent: false, status: 0 };

  const eventTimestamp = Math.floor(new Date(input.eventTime).getTime() / 1000);
  if (!Number.isFinite(eventTimestamp)) return { attempted: false, sent: false, status: 0 };

  const userData: MetaUserData = {};
  if (input.clientIp && input.clientIp !== 'unknown') userData.client_ip_address = input.clientIp;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  const email = input.email.trim().toLocaleLowerCase('sk-SK');
  const phone = normalizedPhone(input.phone);
  if (email) userData.em = [sha256(email)];
  if (phone) userData.ph = [sha256(phone)];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: 'Lead',
        event_time: eventTimestamp,
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: {
          content_name: 'Cenová ponuka',
          material: input.material,
        },
      },
    ],
    access_token: settings.accessToken,
  };
  if (settings.testEventCode) payload.test_event_code = settings.testEventCode;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(
      `https://graph.facebook.com/${settings.apiVersion}/${encodeURIComponent(settings.pixelId)}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      let errorCode: number | null = null;
      let errorSubcode: number | null = null;
      try {
        const body = await response.json() as {
          error?: { code?: unknown; error_subcode?: unknown };
        };
        errorCode = typeof body.error?.code === 'number' ? body.error.code : null;
        errorSubcode = typeof body.error?.error_subcode === 'number' ? body.error.error_subcode : null;
      } catch {
        // Meta did not return a JSON error body. Status is still sufficient for the outbox retry policy.
      }
      // Safe operational metadata only: never log the access token, event payload, or customer data.
      console.warn('Meta CAPI delivery rejected', { status: response.status, errorCode, errorSubcode });
    }
    return { attempted: true, sent: response.ok, status: response.status };
  } catch {
    return { attempted: true, sent: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

function isPermanentMetaDeliveryFailure(status: number) {
  return status >= 400 && status < 500 && status !== 429;
}

function outboxItemToEvent(item: MetaCapiOutboxDispatchItem): MetaLeadEventInput {
  return {
    eventId: item.eventId,
    eventTime: item.eventTime,
    email: item.email,
    phone: item.phone,
    material: item.material,
    eventSourceUrl: item.eventSourceUrl,
    clientIp: item.clientIp,
    clientUserAgent: item.clientUserAgent,
    fbp: item.fbp,
    fbc: item.fbc,
  };
}

export async function dispatchMetaCapiOutbox(options: {
  limit?: number;
  at?: Date;
  sender?: (input: MetaLeadEventInput) => Promise<{ attempted: boolean; sent: boolean; status: number }>;
} = {}) {
  if (!isMetaCapiConfigured()) return { configured: false, claimed: 0, sent: 0, retrying: 0, permanentlyFailed: 0 };
  const claimed = await claimMetaCapiOutboxEvents({ limit: options.limit, at: options.at });
  const sender = options.sender ?? sendMetaLeadEvent;
  let sent = 0;
  let retrying = 0;
  let permanentlyFailed = 0;

  for (const item of claimed) {
    const result = await sender(outboxItemToEvent(item));
    const state = await settleMetaCapiOutboxEvent(item.eventId, item.leaseToken || '', {
      sent: result.sent,
      status: result.status,
      permanent: !result.attempted || isPermanentMetaDeliveryFailure(result.status),
      at: options.at,
    });
    if (state?.state === 'sent') sent += 1;
    if (state?.state === 'retrying') retrying += 1;
    if (state?.state === 'permanently_failed') permanentlyFailed += 1;
  }

  return { configured: true, claimed: claimed.length, sent, retrying, permanentlyFailed };
}
