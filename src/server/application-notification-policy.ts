import type { ApplicationNotification, ApplicationNotificationStatus } from './types';

export type ApplicationRecipientResult = {
  status: 'sent' | 'failed' | 'unknown';
  retryable?: boolean;
  messageId?: string;
  reason?: string;
};

export function notificationState(result: ApplicationRecipientResult): {
  status: ApplicationNotificationStatus;
  retryable: boolean;
} {
  return {
    status: result.status,
    retryable: result.status === 'failed' && result.retryable === true,
  };
}

export function notificationClaimable(status: ApplicationNotificationStatus, retryable: boolean) {
  return status === 'pending' || (status === 'failed' && retryable);
}

export function publicNotificationSummary(notifications: ApplicationNotification[]) {
  return notifications.map(({ recipient, status }) => ({ recipient, status }));
}
