import {
  claimApplicationNotification,
  claimCareerNotificationBatch,
  getApplicationNotificationHealth,
  getApplicationNotificationEntity,
  listDueApplicationNotifications,
  markStaleApplicationNotificationClaimsUnknown,
  recordApplicationNotificationResult,
  recordCareerNotificationBatchResult,
} from './db';
import {
  sendCareerApplicationNotificationBatch,
  sendRooferRegistrationNotification,
} from './mail';
import type { ApplicationRecipientResult } from './application-notification-policy';
import type {
  ApplicationNotification,
  ApplicationNotificationEntity,
  ApplicationNotificationRecipient,
} from './types';

async function persistResult(
  entityType: ApplicationNotificationEntity,
  entityId: string,
  recipient: ApplicationNotificationRecipient,
  token: string,
  result: ApplicationRecipientResult,
) {
  const saved = await recordApplicationNotificationResult(entityType, entityId, recipient, token, result);
  if (!saved) throw new Error('Výsledok notifikácie už nepatrí aktívnemu pokusu.');
}

export async function processCareerApplicationNotificationBatch(entityId: string) {
  const application = await getApplicationNotificationEntity('career_application', entityId);
  if (!application || application.cvExpected && !application.cv) return false;
  const token = await claimCareerNotificationBatch(entityId);
  if (!token) return false;
  let result: Awaited<ReturnType<typeof sendCareerApplicationNotificationBatch>>;
  try {
    result = await sendCareerApplicationNotificationBatch(application);
  } catch (error) {
    // The relay may have accepted either email before its response was lost.
    // Mark both roles unknown; never retry the pair automatically in that case.
    const reason = error instanceof Error ? error.message : 'Výsledok relaya nie je možné potvrdiť.';
    const saved = await recordCareerNotificationBatchResult(entityId, token, {
      applicant: { status: 'unknown', retryable: false, reason },
      internal: { status: 'unknown', retryable: false, reason },
    });
    if (!saved) throw new Error('Výsledok kariérneho emailového páru už nepatrí aktívnemu pokusu.');
    return true;
  }
  const saved = await recordCareerNotificationBatchResult(entityId, token, result);
  if (!saved) throw new Error('Výsledok kariérneho emailového páru už nepatrí aktívnemu pokusu.');
  return true;
}

export async function processRooferRegistrationNotification(
  entityId: string,
  recipient: ApplicationNotificationRecipient,
) {
  const token = await claimApplicationNotification('roofer_registration', entityId, recipient);
  if (!token) return false;
  const registration = await getApplicationNotificationEntity('roofer_registration', entityId);
  if (!registration) {
    await persistResult('roofer_registration', entityId, recipient, token, {
      status: 'failed', retryable: false, reason: 'Registrácia sa nenašla v trvalej databáze.',
    });
    return false;
  }
  try {
    const result = await sendRooferRegistrationNotification(registration, recipient);
    await persistResult('roofer_registration', entityId, recipient, token, result);
  } catch (error) {
    // An unclassified interruption may have happened after SMTP accepted the mail.
    await persistResult('roofer_registration', entityId, recipient, token, {
      status: 'unknown', retryable: false,
      reason: error instanceof Error ? error.message : 'Výsledok SMTP odoslania nie je známy.',
    });
  }
  return true;
}

export async function processApplicationNotification(item: ApplicationNotification) {
  if (item.entityType === 'career_application') {
    // The existing career transport is a combined relay call. Retry only as one
    // atomic pair when both recipients are still safely claimable.
    if (item.recipient !== 'applicant') return false;
    return processCareerApplicationNotificationBatch(item.entityId);
  }
  return processRooferRegistrationNotification(item.entityId, item.recipient);
}

export async function runApplicationNotificationRecovery(limit = 2) {
  const staleClaimsMarkedUnknown = await markStaleApplicationNotificationClaimsUnknown();
  const pending = await listDueApplicationNotifications(limit);
  let processed = 0;
  let errors = 0;
  for (const notification of pending) {
    try {
      if (await processApplicationNotification(notification)) processed += 1;
    } catch (error) {
      errors += 1;
      console.error('Application notification recovery failed', {
        entityType: notification.entityType,
        entityId: notification.entityId,
        recipient: notification.recipient,
        error,
      });
    }
  }
  const health = await getApplicationNotificationHealth();
  return { inspected: pending.length, processed, errors, staleClaimsMarkedUnknown, health };
}
