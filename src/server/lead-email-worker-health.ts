export type LeadEmailWorkerAttention = {
  pending: number;
  overduePending: number;
  sending: number;
  staleSending: number;
  failed: number;
  unknown: number;
  oldestUnresolvedAt: string | null;
};

type LeadEmailWorkerRun = {
  errors: number;
  unresolved: number;
  deferred: number;
  pendingWithoutSingleRecipientTransport: boolean;
  attention: LeadEmailWorkerAttention;
  nowMs?: number;
};

function boundedCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function unresolvedAgeMinutes(value: string | null, nowMs: number) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((nowMs - timestamp) / 60_000));
}

export function evaluateLeadEmailWorkerHealth(input: LeadEmailWorkerRun) {
  const attention = {
    pending: boundedCount(input.attention.pending),
    overduePending: boundedCount(input.attention.overduePending),
    sending: boundedCount(input.attention.sending),
    staleSending: boundedCount(input.attention.staleSending),
    failed: boundedCount(input.attention.failed),
    unknown: boundedCount(input.attention.unknown),
    oldestUnresolvedAgeMinutes: unresolvedAgeMinutes(input.attention.oldestUnresolvedAt, input.nowMs ?? Date.now()),
  };
  const backlogNeedsAttention = attention.overduePending > 0
    || attention.staleSending > 0
    || attention.failed > 0
    || attention.unknown > 0;
  const runFailed = input.errors > 0;
  const unavailable = input.unresolved > 0
    || input.deferred > 0
    || input.pendingWithoutSingleRecipientTransport
    || backlogNeedsAttention;
  const ok = !runFailed && !unavailable;

  return {
    ok,
    status: runFailed ? 500 : ok ? 200 : 503,
    attention,
  } as const;
}
