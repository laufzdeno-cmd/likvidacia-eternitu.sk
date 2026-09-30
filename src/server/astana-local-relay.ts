import crypto from 'node:crypto';
import type { CareerApplication, Lead } from './types';

export type LeadDeliveryResult = {
  sent: boolean;
  customerSent: boolean;
  adminSent: boolean;
  reason?: string;
};

export type LeadDeliveryMode = 'smtp' | 'local_relay' | 'smtp_then_local_relay';

export function leadDeliveryMode(): LeadDeliveryMode {
  const value = process.env.LEAD_EMAIL_DELIVERY_MODE?.trim().toLowerCase();
  if (value === 'local_relay' || value === 'smtp_then_local_relay') return value;
  return 'smtp';
}

function relayResult(reason: string): LeadDeliveryResult {
  return { sent: false, customerSent: false, adminSent: false, reason };
}

async function sendPayloadThroughAstanaLocalRelay(payloadObject: Record<string, unknown>): Promise<LeadDeliveryResult> {
  const url = process.env.ASTANA_RELAY_URL?.trim();
  const secret = process.env.ASTANA_RELAY_SECRET;
  if (!url || !secret || secret.length < 32) return relayResult('Lokálny relay nie je nastavený.');

  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    return relayResult('Adresa lokálneho relaya nie je platná.');
  }
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'www.astana.sk') {
    return relayResult('Adresa lokálneho relaya nie je povolená.');
  }

  const payload = JSON.stringify(payloadObject);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-astana-relay-timestamp': timestamp, 'x-astana-relay-signature': signature },
      body: payload,
    });
    const responseBody = await response.text();
    let result: { ok?: unknown; customerSent?: unknown; adminSent?: unknown } | null = null;
    try {
      result = JSON.parse(responseBody) as { ok?: unknown; customerSent?: unknown; adminSent?: unknown };
    } catch {
      return relayResult('Lokálny relay vrátil neplatnú odpoveď.');
    }
    if (!response.ok || result?.ok !== true || result.customerSent !== true || result.adminSent !== true) {
      return relayResult('Lokálny relay e-mail nepotvrdil.');
    }
    return { sent: true, customerSent: true, adminSent: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return relayResult('Lokálny relay nestihol odpovedať.');
    return relayResult('Lokálny relay sa nepodarilo kontaktovať.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendLeadThroughAstanaLocalRelay(
  lead: Lead,
  fileCount: number,
  businessJobId?: string,
): Promise<LeadDeliveryResult> {
  return sendPayloadThroughAstanaLocalRelay({
    submissionId: lead.id,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    district: lead.district || '',
    objectType: lead.objectType,
    materialType: lead.materialType,
    areaEstimate: lead.areaEstimate,
    preferredContact: lead.preferredContact || '',
    term: lead.term || '',
    note: lead.note || '',
    fileCount,
    businessJobId: businessJobId || '',
  });
}

export async function sendCareerApplicationThroughAstanaLocalRelay(application: CareerApplication): Promise<LeadDeliveryResult> {
  return sendPayloadThroughAstanaLocalRelay({
    kind: 'career_application',
    submissionId: application.id,
    fullName: application.fullName,
    email: application.email,
    phone: application.phone,
    city: application.city,
    cooperationType: application.cooperationType,
    workRegions: application.workRegions,
    hasTradeLicense: application.hasTradeLicense,
    workAtHeights: application.workAtHeights,
    hasAsbestosExperience: application.hasAsbestosExperience,
    asbestosExperience: application.asbestosExperience,
    experience: application.experience,
    note: application.note,
    hasCv: Boolean(application.cv),
  });
}
