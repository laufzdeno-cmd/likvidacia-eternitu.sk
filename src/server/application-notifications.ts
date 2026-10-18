import {
  claimApplicationNotification,
  getApplicationNotificationHealth,
  getApplicationNotificationEntity,
  listDueApplicationNotifications,
  markStaleApplicationNotificationClaimsUnknown,
  recordApplicationNotificationResult,
} from './db';
import {
  sendCareerApplicationNotification,
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

export async function processCareerApplicationNotification(
  entityId: string,
  recipient: ApplicationNotificationRecipient,
) {
  const application = await getApplicationNotificationEntity('career_application', entityId);
  if (!application || application.cvExpected && !application.cv) return false;
  const token = await claimApplicationNotification('career_application', entityId, recipient);
  if (!token) return false;
  try {
    const result = await sendCareerApplicationNotification(application, recipient);
    await persistResult('career_application', entityId, recipient, token, result);
  } catch (error) {
    // The SMTP server may have accepted this exact recipient before the
    // connection was interrupted. Unknown outcomes are never retried
    // automatically, so a person must first verify delivery evidence.
    await persistResult('career_application', entityId, recipient, token, {
      status: 'unknown',
      retryable: false,
      reason: error instanceof Error ? error.message : 'Výsledok SMTP odoslania nie je známy.',
    });
  }
  return true;
}

export async function processCareerApplicationNotificationBatch(entityId: string) {
  let processed = false;
  for (const recipient of ['applicant', 'internal'] as const) {
    if (await processCareerApplicationNotification(entityId, recipient)) processed = true;
  }
  return processed;
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
    return processCareerApplicationNotification(item.entityId, item.recipient);
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
