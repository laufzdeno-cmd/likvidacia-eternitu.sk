import { createHash, createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import {
  claimOpsAlert,
  completeOpsAlert,
  releaseOpsAlertClaim,
} from './db';
import {
  getOpsAlertConfiguration,
  isPublicOpsAlertIpAddress,
  normalizeOpsAlertObservation,
  type OpsAlertAuditSummary,
  type OpsAlertClaim,
  type OpsAlertObservation,
  type OpsAlertTransition,
} from './ops-alert-policy';

type OpsAlertStore = {
  claim: typeof claimOpsAlert;
  complete: typeof completeOpsAlert;
  release: typeof releaseOpsAlertClaim;
};

type OpsAlertDependencies = {
  environment?: Record<string, string | undefined>;
  now?: () => Date;
  resolveAddresses?: (hostname: string) => Promise<string[]>;
  store?: OpsAlertStore;
  timeoutMs?: number;
  transport?: OpsAlertTransport;
};

export type OpsAlertDispatchResult = {
  status: 'disabled' | 'misconfigured' | 'not_needed' | 'sent' | 'sent_unconfirmed' | 'delivery_unknown' | 'failed';
};

const webhookTimeoutMs = 3_000;

type OpsAlertTransportInput = {
  body: string;
  family: 4 | 6;
  headers: Record<string, string>;
  pinnedAddress: string;
  timeoutMs: number;
  url: URL;
};

type OpsAlertTransport = (input: OpsAlertTransportInput) => Promise<'accepted' | 'rejected' | 'unknown'>;

function fingerprint(observation: OpsAlertObservation) {
  return createHash('sha256').update(JSON.stringify({
    worker: observation.worker,
    state: observation.state,
    reasonCodes: observation.reasonCodes,
  })).digest('hex');
}

async function defaultResolveAddresses(hostname: string) {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((item) => item.address);
}

async function resolveWithin(
  hostname: string,
  resolveAddresses: (hostname: string) => Promise<string[]>,
  timeoutMs: number,
) {
  return new Promise<string[]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Operations alert DNS lookup timed out.')), timeoutMs);
    resolveAddresses(hostname).then(
      (addresses) => { clearTimeout(timeout); resolve(addresses); },
      (error) => { clearTimeout(timeout); reject(error); },
    );
  });
}

async function defaultPinnedHttpsTransport(input: OpsAlertTransportInput) {
  return new Promise<'accepted' | 'rejected' | 'unknown'>((resolve) => {
    let settled = false;
    let absoluteTimeout: ReturnType<typeof setTimeout> | undefined;
    const settle = (result: 'accepted' | 'rejected' | 'unknown') => {
      if (settled) return;
      settled = true;
      if (absoluteTimeout) clearTimeout(absoluteTimeout);
      resolve(result);
    };
    const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
      callback(null, input.pinnedAddress, input.family);
    };
    const outgoing = request(input.url, {
      method: 'POST',
      headers: input.headers,
      lookup: pinnedLookup,
      servername: isIP(input.url.hostname) ? undefined : input.url.hostname,
      rejectUnauthorized: true,
      agent: false,
    }, (response) => {
      const status = response.statusCode ?? 0;
      response.destroy();
      settle(status >= 200 && status < 300 ? 'accepted' : 'rejected');
    });
    outgoing.once('error', () => settle('unknown'));
    absoluteTimeout = setTimeout(
      () => outgoing.destroy(new Error('Operations alert webhook timed out.')),
      input.timeoutMs,
    );
    outgoing.end(input.body);
  });
}

async function deliverWebhook(input: {
  webhookUrl: string;
  signingSecret: string;
  eventId: string;
  observation: OpsAlertObservation;
  transition: OpsAlertTransition;
  observedAt: string;
  resolveAddresses: (hostname: string) => Promise<string[]>;
  timeoutMs: number;
  transport: OpsAlertTransport;
}) {
  const deadline = Date.now() + input.timeoutMs;
  let addresses: string[];
  try {
    const hostname = new URL(input.webhookUrl).hostname.replace(/^\[|\]$/g, '');
    addresses = isIP(hostname)
      ? [hostname]
      : await resolveWithin(hostname, input.resolveAddresses, Math.max(1, deadline - Date.now()));
    if (addresses.length === 0 || !addresses.every(isPublicOpsAlertIpAddress)) return 'destination_unsafe' as const;
  } catch {
    return 'destination_unsafe' as const;
  }
  const body = JSON.stringify({
    schemaVersion: 1,
    eventId: input.eventId,
    worker: input.observation.worker,
    state: input.observation.state,
    transition: input.transition,
    reasonCodes: input.observation.reasonCodes,
    metrics: input.observation.metrics,
    observedAt: input.observedAt,
  });
  const signature = createHmac('sha256', input.signingSecret)
    .update(`${input.observedAt}.${body}`)
    .digest('hex');
  const pinnedAddress = addresses[0];
  const family = isIP(pinnedAddress);
  if (family !== 4 && family !== 6) return 'destination_unsafe' as const;
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) return 'unknown' as const;
  return input.transport({
    url: new URL(input.webhookUrl),
    pinnedAddress,
    family,
    timeoutMs: remainingMs,
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
      'user-agent': 'ASTANA-Operations-Alert/1.0',
      'x-astana-alert-id': input.eventId,
      'x-astana-alert-timestamp': input.observedAt,
      'x-astana-alert-signature': `sha256=${signature}`,
    },
    body,
  });
}

export async function dispatchOpsAlert(
  rawObservation: OpsAlertObservation,
  dependencies: OpsAlertDependencies = {},
): Promise<OpsAlertDispatchResult> {
  const config = getOpsAlertConfiguration(dependencies.environment ?? process.env);
  if (config.status === 'disabled') return { status: 'disabled' };
  if (config.status === 'misconfigured') return { status: 'misconfigured' };

  const observation = normalizeOpsAlertObservation(rawObservation);
  const now = dependencies.now?.() ?? new Date();
  const observedAt = now.toISOString();
  const store = dependencies.store ?? {
    claim: claimOpsAlert,
    complete: completeOpsAlert,
    release: releaseOpsAlertClaim,
  };
  const resolveAddresses = dependencies.resolveAddresses ?? defaultResolveAddresses;
  const timeoutMs = dependencies.timeoutMs && dependencies.timeoutMs > 0
    ? dependencies.timeoutMs
    : webhookTimeoutMs;
  const transport = dependencies.transport ?? defaultPinnedHttpsTransport;
  const summary: OpsAlertAuditSummary = {
    reasonCodes: observation.reasonCodes,
    metrics: observation.metrics,
  };

  let claim: OpsAlertClaim | null;
  try {
    claim = await store.claim({
      worker: observation.worker,
      state: observation.state,
      fingerprint: fingerprint(observation),
      repeatAfterMinutes: config.repeatAfterMinutes,
      now: observedAt,
    });
  } catch {
    return { status: 'failed' };
  }

  if (!claim) return { status: 'not_needed' };

  try {
    const delivery = await deliverWebhook({
      webhookUrl: config.webhookUrl,
      signingSecret: config.signingSecret,
      eventId: claim.claimId,
      observation,
      transition: claim.transition,
      observedAt,
      resolveAddresses,
      timeoutMs,
      transport,
    });
    if (delivery === 'unknown') {
      return { status: 'delivery_unknown' };
    }
    if (delivery !== 'accepted') {
      await store.release(claim.worker, claim.claimId).catch(() => false);
      return { status: 'failed' };
    }
    const completed = await store.complete({
      worker: claim.worker,
      claimId: claim.claimId,
      deliveredAt: observedAt,
      summary,
    });
    return { status: completed ? 'sent' : 'sent_unconfirmed' };
  } catch {
    return { status: 'failed' };
  }
}
