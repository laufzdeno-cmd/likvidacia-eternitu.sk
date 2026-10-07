export type EmailAttemptStatus = 'sent' | 'failed' | 'unknown';

export function classifySmtpError(error: unknown): EmailAttemptStatus {
  const responseCode = Number((error as { responseCode?: unknown } | null)?.responseCode);
  return responseCode >= 400 && responseCode < 600 ? 'failed' : 'unknown';
}

export function classifySmtpAcceptance(info: { accepted?: unknown; rejected?: unknown }): EmailAttemptStatus {
  const acceptedCount = Array.isArray(info.accepted) ? info.accepted.length : 0;
  const rejectedCount = Array.isArray(info.rejected) ? info.rejected.length : 0;
  if (acceptedCount > 0 && rejectedCount === 0) return 'sent';
  if (acceptedCount === 0 && rejectedCount > 0) return 'failed';
  // No envelope-recipient proof or partial acceptance is ambiguous; never blindly retry it.
  return 'unknown';
}

function normalizeMailbox(value: unknown) {
  if (typeof value !== 'string') return '';
  const address = value.match(/<([^>]+)>/)?.[1] || value;
  return address.trim().toLowerCase();
}

export function classifyRequiredSmtpRecipient(
  info: { accepted?: unknown; rejected?: unknown },
  requiredRecipient: string,
): EmailAttemptStatus {
  const required = normalizeMailbox(requiredRecipient);
  if (!required) return 'unknown';
  const accepted = Array.isArray(info.accepted) ? info.accepted.map(normalizeMailbox) : [];
  const rejected = Array.isArray(info.rejected) ? info.rejected.map(normalizeMailbox) : [];
  const requiredAccepted = accepted.includes(required);
  const requiredRejected = rejected.includes(required);
  if (requiredAccepted && !requiredRejected) return 'sent';
  if (!requiredAccepted && requiredRejected) return 'failed';
  return 'unknown';
}

export function isRetryableSmtpFailure(errorOrInfo: unknown) {
  const responseCode = Number((errorOrInfo as { responseCode?: unknown } | null)?.responseCode);
  return responseCode >= 400 && responseCode < 500;
}
