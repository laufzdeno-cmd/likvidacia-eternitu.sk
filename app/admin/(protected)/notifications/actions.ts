'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, verifyCsrf } from '@/src/server/auth';
import { prepareConfirmedApplicationNotificationRetry, resolveUnknownApplicationNotification } from '@/src/server/db';
import { processCareerApplicationNotification, processRooferRegistrationNotification } from '@/src/server/application-notifications';
import { isApplicationNotificationEvidenceValid } from '@/src/server/application-notification-evidence.mjs';
import type { ApplicationNotificationEntity, ApplicationNotificationRecipient } from '@/src/server/types';

export async function resolveApplicationNotificationUnknownAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const entityType = String(formData.get('entityType') || '');
  const entityId = String(formData.get('entityId') || '');
  const recipient = String(formData.get('recipient') || '');
  const resolution = String(formData.get('resolution') || '');
  const evidence = formData.get('evidence');
  const checked = String(formData.get('checkedEvidence') || '');

  if ((entityType !== 'career_application' && entityType !== 'roofer_registration')
    || (recipient !== 'applicant' && recipient !== 'internal')
    || (resolution !== 'delivered' && resolution !== 'not_delivered')
    || checked !== 'yes'
    || !isApplicationNotificationEvidenceValid(resolution, evidence)) {
    throw new Error('Vyberte zodpovedajúci typ overeného dôkazu a potvrďte kontrolu schránky.');
  }

  const saved = await resolveUnknownApplicationNotification({
    entityType: entityType as ApplicationNotificationEntity,
    entityId,
    recipient: recipient as ApplicationNotificationRecipient,
    resolution,
    evidence,
    actorEmail: actor,
  });
  if (!saved) throw new Error('Stav už nie je neznámy alebo sa záznam nenašiel. Obnovte stránku a skontrolujte aktuálny stav.');

  revalidatePath(entityType === 'career_application' ? '/admin/kariera' : '/admin/strechari');
}

export async function retryConfirmedApplicationNotificationAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdmin();
  const entityType = String(formData.get('entityType') || '');
  const entityId = String(formData.get('entityId') || '');
  const recipient = String(formData.get('recipient') || '');
  const checked = String(formData.get('confirmedNonDelivery') || '');
  if ((entityType !== 'career_application' && entityType !== 'roofer_registration')
    || (recipient !== 'applicant' && recipient !== 'internal')
    || checked !== 'yes') {
    throw new Error('Pred opakovaným odoslaním výslovne potvrďte, že doručenie bolo overené ako neúspešné.');
  }

  const queued = await prepareConfirmedApplicationNotificationRetry({
    entityType: entityType as ApplicationNotificationEntity,
    entityId,
    recipient: recipient as ApplicationNotificationRecipient,
    actorEmail: actor,
  });
  if (!queued) throw new Error('Opakovanie nie je povolené: nedoručenie nemusí byť potvrdené alebo sa zmenil stav. Obnovte stránku.');

  if (entityType === 'career_application') {
    await processCareerApplicationNotification(entityId, recipient as ApplicationNotificationRecipient);
    revalidatePath('/admin/kariera');
  } else {
    await processRooferRegistrationNotification(entityId, recipient as ApplicationNotificationRecipient);
    revalidatePath('/admin/strechari');
  }
}
