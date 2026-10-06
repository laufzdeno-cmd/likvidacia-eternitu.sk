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

export function isRetryableSmtpFailure(errorOrInfo: unknown) {
  const responseCode = Number((errorOrInfo as { responseCode?: unknown } | null)?.responseCode);
  return responseCode >= 400 && responseCode < 500;
}
