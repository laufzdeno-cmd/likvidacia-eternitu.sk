import { isIP } from 'node:net';

export const opsAlertWorkers = ['lead_email_delivery', 'application_notifications'] as const;
export type OpsAlertWorker = (typeof opsAlertWorkers)[number];

export const opsAlertReasonCodes = [
  'transport_not_configured',
  'run_errors',
  'unresolved_delivery',
  'deferred_delivery',
  'single_recipient_transport_unavailable',
  'overdue_pending',
  'stale_sending',
  'failed_delivery',
  'unknown_delivery',
  'pending_backlog',
  'stale_claim_recovered',
  'worker_exception',
] as const;

export type OpsAlertReasonCode = (typeof opsAlertReasonCodes)[number];
export const opsAlertMetricKeys = [
  'errors',
  'unresolved',
  'deferred',
  'pending',
  'overdue_pending',
  'sending',
  'stale_sending',
  'failed',
  'unknown',
  'oldest_unresolved_age_minutes',
  'stale_claims_marked_unknown',
] as const;
export type OpsAlertState = 'healthy' | 'unhealthy';
export type OpsAlertTransition = 'degraded' | 'repeated' | 'recovered';

export type OpsAlertObservation = {
  worker: OpsAlertWorker;
  state: OpsAlertState;
  reasonCodes: OpsAlertReasonCode[];
  metrics: Record<string, number>;
};

export type OpsAlertClaim = {
  claimId: string;
  worker: OpsAlertWorker;
  state: OpsAlertState;
  transition: OpsAlertTransition;
  fingerprint: string;
};

export type OpsAlertAuditSummary = {
  reasonCodes: OpsAlertReasonCode[];
  metrics: Record<string, number>;
};

type RuntimeEnvironment = Record<string, string | undefined>;

export type OpsAlertConfiguration =
  | { status: 'disabled' }
  | {
    status: 'misconfigured';
    issue: 'missing_webhook_url' | 'invalid_webhook_url' | 'missing_signing_secret' | 'invalid_repeat_interval';
  }
  | {
    status: 'ready';
    webhookUrl: string;
    signingSecret: string;
    repeatAfterMinutes: number;
  };

const allowedReasonCodes = new Set<string>(opsAlertReasonCodes);
const allowedMetricKeys = new Set<string>(opsAlertMetricKeys);
const allowedWorkers = new Set<string>(opsAlertWorkers);

function isNonPublicIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return parts[0] === 0
    || parts[0] === 10
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 0 && parts[2] === 0)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19))
    || parts[0] >= 224;
}

function isNonPublicIpv6(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')
    || normalized.startsWith('ff');
}

export function isPublicOpsAlertIpAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return !isNonPublicIpv4(normalized);
  if (ipVersion !== 6 || isNonPublicIpv6(normalized)) return false;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isIP(mapped) === 4 && !isNonPublicIpv4(mapped);
  }
  return true;
}

function validWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !hostname) return false;
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return false;
    const ipVersion = isIP(hostname.replace(/^\[|\]$/g, ''));
    if (ipVersion && !isPublicOpsAlertIpAddress(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function getOpsAlertConfiguration(environment: RuntimeEnvironment = process.env): OpsAlertConfiguration {
  if (environment.OPS_ALERT_ENABLED !== 'true') return { status: 'disabled' };

  const webhookUrl = environment.OPS_ALERT_WEBHOOK_URL?.trim() ?? '';
  if (!webhookUrl) return { status: 'misconfigured', issue: 'missing_webhook_url' };
  if (!validWebhookUrl(webhookUrl)) return { status: 'misconfigured', issue: 'invalid_webhook_url' };

  const signingSecret = environment.OPS_ALERT_SIGNING_SECRET ?? '';
  if (!signingSecret) return { status: 'misconfigured', issue: 'missing_signing_secret' };
  if (signingSecret !== signingSecret.trim() || signingSecret.length < 32 || signingSecret.length > 1024) {
    return { status: 'misconfigured', issue: 'missing_signing_secret' };
  }

  const rawRepeat = environment.OPS_ALERT_REPEAT_MINUTES?.trim() || '60';
  if (!/^\d+$/.test(rawRepeat)) return { status: 'misconfigured', issue: 'invalid_repeat_interval' };
  const repeatAfterMinutes = Number(rawRepeat);
  if (!Number.isSafeInteger(repeatAfterMinutes) || repeatAfterMinutes < 15 || repeatAfterMinutes > 1440) {
    return { status: 'misconfigured', issue: 'invalid_repeat_interval' };
  }

  return { status: 'ready', webhookUrl, signingSecret, repeatAfterMinutes };
}

function boundedMetric(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1_000_000_000, Math.max(0, Math.trunc(value)));
}

export function normalizeOpsAlertObservation(input: OpsAlertObservation): OpsAlertObservation {
  if (!allowedWorkers.has(input.worker)) throw new Error('Unsupported operations alert worker.');
  const reasonCodes = [...new Set(input.reasonCodes.filter((reason) => allowedReasonCodes.has(reason)))].sort() as OpsAlertReasonCode[];
  const metrics = Object.fromEntries(Object.entries(input.metrics)
    .filter(([key]) => allowedMetricKeys.has(key))
    .slice(0, 20)
    .map(([key, value]) => [key, boundedMetric(value)]));
  return {
    worker: input.worker,
    state: input.state === 'healthy' ? 'healthy' : 'unhealthy',
    reasonCodes,
    metrics,
  };
}
