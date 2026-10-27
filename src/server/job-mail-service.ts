import { getGmailPriceOfferConfiguration, decryptGmailSecret } from './gmail-price-offer-config';
import { getGmailPriceOfferConnectionSecret, disconnectGmailPriceOfferConnection } from './gmail-price-offer-db';
import { getGmailProfile, refreshGmailAccessToken, revokeGoogleRefreshToken } from './gmail-price-offer-api';
import { appendJobCommunication, getJobPrivateDocument, registerJobPrivateDocument, bindJobPrivateDocument } from './job-workspace-db';
import { listJobGmailLabels, listScopedJobGmailMessages, readJobGmailMessage, readJobGmailPdfAttachment } from './job-mail-api';
import { disableJobMailSync, mutateJobMailStore, readJobMailStore, saveJobMailConfiguration, stageJobMailMessages } from './job-mail-store';
import { privateDocumentPublicView, storeJobPrivateUpload } from './job-private-storage';
import type { JobMailConfiguration, JobMailMatch, JobMailMatchCandidate, JobMailMessage } from './job-mail-types';
import type { JobWorkspaceActor } from './job-workspace-types';

function requireSuperadmin(actor: JobWorkspaceActor) {
  if (actor.role !== 'SUPER_ADMIN' || !actor.email) throw new Error('Gmail môže spravovať iba superadmin.');
}
function requireVerification() {
  if (process.env.ASTANA_JOB_GMAIL_VERIFIED !== 'true') throw new Error('Čítanie Gmailu čaká na potvrdenie overenia Google.');
}
async function approvedAccessToken(actor: JobWorkspaceActor) {
  requireSuperadmin(actor);
  requireVerification();
  const config = getGmailPriceOfferConfiguration();
  if (!config.configured || !config.encryptionKey) throw new Error('Oficiálne pripojenie Gmailu nie je nastavené.');
  const secret = await getGmailPriceOfferConnectionSecret();
  if (!secret || secret.connection.emailAddress.toLowerCase() !== config.allowedAccountEmail) throw new Error('Povolený firemný Gmail nie je pripojený.');
  const token = await refreshGmailAccessToken(decryptGmailSecret(secret.encryptedRefreshToken, config.encryptionKey));
  if (await getGmailProfile(token) !== config.allowedAccountEmail) throw new Error('Pripojený Gmail nezodpovedá povolenému firemnému účtu.');
  return { token, account: config.allowedAccountEmail };
}

export function suggestJobMailMatches(message: JobMailMessage, candidates: JobMailMatchCandidate[]): JobMailMatch[] {
  const text = `${message.subject}\n${message.text}`.toLocaleLowerCase('sk');
  const counterparts = message.direction === 'INBOUND' ? [message.sender] : message.recipients;
  return candidates.flatMap((candidate): JobMailMatch[] => {
    const reasons: string[] = [];
    const exactOffer = candidate.offerNumbers.filter((number) => number.length >= 4).find((number) => {
      const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
    });
    if (exactOffer) reasons.push(`Číslo ponuky ${exactOffer}`);
    if (candidate.email && counterparts.includes(candidate.email.toLowerCase())) reasons.push('Zhodný email zákazníka');
    // Contact matches are suggestions, never automatic linkage: one person can have several jobs.
    return reasons.length ? [{ jobId: candidate.jobId, reasons, strength: exactOffer ? 'EXACT_OFFER' : 'CONTACT_ONLY' }] : [];
  }).slice(0, 30);
}

export async function getJobMailAdminView(actor: JobWorkspaceActor, options: { page?: number; pageSize?: number; review?: 'PENDING' | 'LINKED' | 'IGNORED' } = {}) {
  requireSuperadmin(actor);
  const state = await readJobMailStore(actor);
  const config = getGmailPriceOfferConfiguration();
  const pageSize = Math.max(1, Math.min(50, Math.floor(options.pageSize || 20)));
  const matches = state.messages.filter((item) => !options.review || item.review === options.review).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.max(1, Math.min(totalPages, Math.floor(options.page || 1)));
  return { configuration: state.configuration, verificationReady: process.env.ASTANA_JOB_GMAIL_VERIFIED === 'true', oauthConfigured: config.configured,
    messages: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, totalPages, pending: state.messages.filter((item) => item.review === 'PENDING').length,
    hasMoreHistory: Object.values(state.pageTokens).some(Boolean) };
}
export async function getJobMailLabels(actor: JobWorkspaceActor) {
  const { token } = await approvedAccessToken(actor);
  return listJobGmailLabels(token);
}
export async function configureJobMailSync(input: Omit<JobMailConfiguration, 'revision' | 'updatedAt' | 'updatedBy'> & { expectedRevision: number }, actor: JobWorkspaceActor) {
  requireSuperadmin(actor);
  if (input.enabled) {
    const { token } = await approvedAccessToken(actor);
    const allowedLabels = new Set((await listJobGmailLabels(token)).map((label) => label.id));
    if (input.labelIds.some((label) => !allowedLabels.has(label))) throw new Error('Vyberte existujúce firemné štítky pripojeného Gmailu.');
  }
  return saveJobMailConfiguration(input, actor);
}

/** Explicit, bounded SA request. No cron, outgoing emails, mark-as-sent or offer acceptance is performed here. */
export async function synchronizeJobMail(actor: JobWorkspaceActor, candidates: JobMailMatchCandidate[] = []) {
  requireSuperadmin(actor);
  const state = await readJobMailStore(actor);
  if (!state.configuration.enabled || !state.configuration.verificationAcknowledged) throw new Error('Synchronizácia Gmailu je vypnutá.');
  const { token, account } = await approvedAccessToken(actor);
  const page = await listScopedJobGmailMessages(token, { labelIds: state.configuration.labelIds, since: state.configuration.since, limit: state.configuration.maxMessages, pageTokens: state.pageTokens });
  const known = new Set(state.messages.filter((item) => item.account === account).map((item) => item.messageId));
  const messages: Array<{ message: JobMailMessage; matches: JobMailMatch[] }> = [];
  for (const messageId of page.messageIds) {
    if (known.has(messageId)) continue;
    const message = await readJobGmailMessage(token, messageId, undefined, state.configuration.labelIds);
    if (message) messages.push({ message, matches: suggestJobMailMatches(message, candidates) });
  }
  const added = await stageJobMailMessages({ account, messages, pageTokens: page.pageTokens, expectedRevision: state.configuration.revision }, actor);
  return { added, scanned: page.messageIds.length, hasMoreHistory: Object.values(page.pageTokens).some(Boolean) };
}

export async function reviewJobMailMessage(input: { id: string; decision: 'LINK' | 'IGNORE'; jobId?: string; confirmed: boolean }, actor: JobWorkspaceActor) {
  requireSuperadmin(actor);
  if (!input.confirmed || !['LINK', 'IGNORE'].includes(input.decision)) throw new Error('Potvrďte kontrolu správy pred pripojením.');
  return mutateJobMailStore(actor, async (state) => {
    const message = state.messages.find((item) => item.id === input.id);
    if (!message) throw new Error('Správa nie je v schválenom firemnom importe.');
    if (message.review !== 'PENDING') {
      if (message.review === 'LINKED' && message.linkedJobId !== input.jobId) throw new Error('Správa už patrí inej zákazke.');
      return message;
    }
    if (input.decision === 'LINK') {
      if (!input.jobId || !/^[0-9a-f-]{36}$/i.test(input.jobId)) throw new Error('Vyberte zákazku.');
      const documentIds = Object.values(message.attachmentDocuments || {});
      for (const documentId of documentIds) await bindJobPrivateDocument(documentId, input.jobId, actor);
      await appendJobCommunication({ jobId: input.jobId, source: 'GMAIL', sourceMessageId: `gmail:${message.account}:${message.messageId}`, occurredAt: message.occurredAt, subject: message.subject, text: message.text, sender: message.sender, recipient: message.recipients.join(', '), direction: message.direction, documentIds }, actor);
      message.linkedJobId = input.jobId;
      message.review = 'LINKED';
    } else message.review = 'IGNORED';
    message.reviewedAt = new Date().toISOString(); message.reviewedBy = actor.email;
    return message;
  });
}

export async function importJobMailPdf(input: { stagedId: string; attachmentId: string }, actor: JobWorkspaceActor) {
  requireSuperadmin(actor);
  const state = await readJobMailStore(actor);
  if (!state.configuration.enabled) throw new Error('Synchronizácia Gmailu je vypnutá.');
  const message = state.messages.find((item) => item.id === input.stagedId);
  const attachment = message?.pdfAttachments.find((item) => item.attachmentId === input.attachmentId);
  if (!message || !attachment || message.review === 'IGNORED') throw new Error('PDF príloha nie je v schválenom firemnom importe.');
  const existing = message.attachmentDocuments?.[input.attachmentId];
  if (existing) {
    const document = await getJobPrivateDocument(existing, actor);
    if (document) return { document: privateDocumentPublicView(document), extraction: null, sourceMessageId: `gmail:${message.account}:${message.messageId}` };
  }
  const { token, account } = await approvedAccessToken(actor);
  if (account !== message.account) throw new Error('Príloha patrí inému Gmail účtu.');
  const bytes = await readJobGmailPdfAttachment(token, message.messageId, attachment);
  const result = await storeJobPrivateUpload({ bytes, originalName: attachment.filename, mime: attachment.mime, kind: 'PDF', jobId: message.linkedJobId }, actor, { register: registerJobPrivateDocument });
  const canonicalId = await mutateJobMailStore(actor, (current) => {
    if (!current.configuration.enabled || current.configuration.revision !== state.configuration.revision) throw new Error('Synchronizácia bola zastavená.');
    const record = current.messages.find((item) => item.id === message.id);
    if (!record) throw new Error('Správa nie je dostupná.');
    record.attachmentDocuments ||= {};
    record.attachmentDocuments[input.attachmentId] ||= result.document.id;
    return record.attachmentDocuments[input.attachmentId];
  });
  if (canonicalId !== result.document.id) {
    // Concurrent downloads converge to one registered reference. Preserve extra private bytes on an ambiguous save.
    const canonical = await getJobPrivateDocument(canonicalId, actor);
    if (!canonical) throw new Error('Súkromná PDF príloha čaká na kontrolu.');
    return { document: privateDocumentPublicView(canonical), extraction: result.extraction, sourceMessageId: `gmail:${message.account}:${message.messageId}` };
  }
  return { document: privateDocumentPublicView(result.document), extraction: result.extraction, sourceMessageId: `gmail:${message.account}:${message.messageId}` };
}

export async function disconnectJobMail(actor: JobWorkspaceActor) {
  requireSuperadmin(actor);
  await disableJobMailSync(actor);
  const config = getGmailPriceOfferConfiguration();
  const secret = await getGmailPriceOfferConnectionSecret();
  // Local deactivation happens before the best-effort revocation; retained approved history stays private.
  await disconnectGmailPriceOfferConnection(actor.email);
  if (secret && config.encryptionKey) await revokeGoogleRefreshToken(decryptGmailSecret(secret.encryptedRefreshToken, config.encryptionKey));
  return { disconnected: true };
}
