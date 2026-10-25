'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminUser, requireFacebookAdminUser, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import {
  completeFacebookOutboundMessage,
  disconnectFacebookPageConnection,
  getFacebookConversation,
  getFacebookPageConnectionSecret,
  linkFacebookConversationToLead,
  prepareFacebookOutboundMessage,
  resolveFacebookUnknownMessage,
  unlinkFacebookConversationFromLead,
  updateFacebookConversationWorkflow,
} from '@/src/server/facebook-messenger-db';
import type { FacebookConversationStatus } from '@/src/server/facebook-messenger-types';
import { decryptFacebookPageToken, getFacebookMessengerConfiguration } from '@/src/server/facebook-messenger-config';
import { isWithinFacebookReplyWindow, normalizeFacebookReply } from '@/src/server/facebook-messenger-policy';
import { sendFacebookTextMessage, unsubscribeFacebookPage } from '@/src/server/facebook-messenger-api';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set<FacebookConversationStatus>(['nova', 'riesi_sa', 'cakame_na_zakaznika', 'vybavena']);

function conversationId(formData: FormData) {
  const id = String(formData.get('id') || '');
  if (!uuidPattern.test(id)) throw new Error('Neplatná Facebook konverzácia.');
  return id;
}
export async function saveFacebookConversationWorkflowAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const id = conversationId(formData);
  const status = String(formData.get('status') || '') as FacebookConversationStatus;
  if (!statuses.has(status)) throw new Error('Neplatný stav konverzácie.');
  await updateFacebookConversationWorkflow({
    id,
    status,
    assignedTo: String(formData.get('assignedTo') || '').trim().toLowerCase(),
    actorEmail: admin.email,
  });
  revalidatePath('/admin/facebook');
  revalidatePath(`/admin/facebook/${id}`);
}

export async function linkFacebookConversationAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const id = conversationId(formData);
  const leadId = String(formData.get('leadId') || '').trim();
  if (!uuidPattern.test(leadId)) throw new Error('Vyberte platný dopyt.');
  await linkFacebookConversationToLead(id, leadId, admin.email);
  revalidatePath('/admin/facebook');
  revalidatePath(`/admin/facebook/${id}`);
}

export async function unlinkFacebookConversationAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const id = conversationId(formData);
  await unlinkFacebookConversationFromLead(id, admin.email);
  revalidatePath('/admin/facebook');
  revalidatePath(`/admin/facebook/${id}`);
}

export async function sendFacebookReplyAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireFacebookAdminUser();
  const id = conversationId(formData);
  const requestId = String(formData.get('clientRequestId') || '');
  if (!uuidPattern.test(requestId)) throw new Error('Neplatný identifikátor odoslania. Obnovte stránku.');
  const text = normalizeFacebookReply(formData.get('message'));
  const config = getFacebookMessengerConfiguration();
  if (!config.configured || !config.encryptionKey) redirect(`/admin/facebook/${id}?send=configuration`);
  const expectedParticipantId = admin.role === 'META_REVIEWER' ? config.reviewParticipantId : '';
  if (admin.role === 'META_REVIEWER' && !expectedParticipantId) redirect('/admin/facebook?access=restricted');
  const conversation = await getFacebookConversation(id, expectedParticipantId);
  if (!conversation || !isWithinFacebookReplyWindow(conversation.lastInboundAt)) redirect(`/admin/facebook/${id}?send=window`);
  const prepared = await prepareFacebookOutboundMessage({
    conversationId: id,
    clientRequestId: requestId,
    text,
    actorEmail: admin.email,
    expectedParticipantId,
  });
  if (prepared.duplicate) redirect(`/admin/facebook/${id}?send=duplicate`);
  const pageAccessToken = decryptFacebookPageToken(prepared.encryptedPageAccessToken, config.encryptionKey);
  const result = await sendFacebookTextMessage({
    pageId: prepared.conversation.pageId,
    participantId: prepared.conversation.participantId,
    text,
    pageAccessToken,
  });
  await completeFacebookOutboundMessage({
    messageId: prepared.message.id,
    conversationId: id,
    status: result.status,
    providerMessageId: result.status === 'sent' ? result.providerMessageId : undefined,
    errorCode: result.status === 'sent' ? undefined : result.errorCode,
    actorEmail: admin.email,
  });
  revalidatePath('/admin/facebook');
  revalidatePath(`/admin/facebook/${id}`);
  redirect(`/admin/facebook/${id}?send=${result.status}`);
}

export async function resolveFacebookUnknownDeliveryAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireAdminUser();
  const id = conversationId(formData);
  const messageId = String(formData.get('messageId') || '');
  const outcome = String(formData.get('outcome') || '');
  const evidence = String(formData.get('evidence') || '').trim().slice(0, 500);
  if (!uuidPattern.test(messageId) || (outcome !== 'sent' && outcome !== 'failed') || formData.get('checkedFacebook') !== 'yes' || evidence.length < 5) {
    throw new Error('Potvrďte kontrolu Facebooku, vyberte výsledok a zapíšte stručný dôkaz.');
  }
  await resolveFacebookUnknownMessage({ conversationId: id, messageId, outcome, evidence, actorEmail: admin.email });
  revalidatePath('/admin/facebook');
  revalidatePath(`/admin/facebook/${id}`);
}

export async function disconnectFacebookPageAction(formData: FormData) {
  await verifyCsrf(formData);
  const admin = await requireSuperAdmin();
  const config = getFacebookMessengerConfiguration();
  const pageId = String(formData.get('pageId') || '');
  const connection = await getFacebookPageConnectionSecret(pageId);
  if (!connection || !config.encryptionKey) throw new Error('Aktívne pripojenie sa nenašlo.');
  const token = decryptFacebookPageToken(connection.encryptedPageAccessToken, config.encryptionKey);
  await unsubscribeFacebookPage(pageId, token);
  await disconnectFacebookPageConnection(pageId, admin.email);
  revalidatePath('/admin/facebook');
  redirect('/admin/facebook?connect=disconnected');
}
