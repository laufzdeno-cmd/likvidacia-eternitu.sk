import type { JobMailMessage, JobMailPdfAttachment } from './job-mail-types';
import { jobPdfLimits } from './job-pdf-extraction';

type GmailPart = { mimeType?: string; filename?: string; headers?: Array<{ name?: string; value?: string }>; body?: { attachmentId?: string; data?: string; size?: number }; parts?: GmailPart[] };
type GmailFullMessage = { id?: string; threadId?: string; internalDate?: string; labelIds?: string[]; payload?: GmailPart };
export type JobMailTransport = typeof fetch;
export class JobMailApiError extends Error {
  constructor(public readonly code: 'gmail_timeout' | 'gmail_network_error' | 'gmail_authorization_failed' | 'gmail_rate_limited' | 'gmail_response_invalid' | 'gmail_response_too_large' | 'gmail_unavailable') { super(code); }
}

async function requestJson<T>(token: string, route: string, transport: JobMailTransport = fetch): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await transport(`https://gmail.googleapis.com/gmail/v1/users/me${route}`, { method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal: controller.signal, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) throw new JobMailApiError('gmail_authorization_failed');
    if (response.status === 429) throw new JobMailApiError('gmail_rate_limited');
    if (!response.ok) throw new JobMailApiError('gmail_unavailable');
    if (!response.body || Number(response.headers.get('content-length')) > 5 * 1024 * 1024) throw new JobMailApiError('gmail_response_too_large');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.length;
        if (length > 5 * 1024 * 1024) { await reader.cancel(); throw new JobMailApiError('gmail_response_too_large'); }
        chunks.push(next.value);
      }
    } finally { reader.releaseLock(); }
    try { return JSON.parse(Buffer.concat(chunks, length).toString('utf8')) as T; }
    catch { throw new JobMailApiError('gmail_response_invalid'); }
  } catch (error) {
    if (error instanceof JobMailApiError) throw error;
    throw new JobMailApiError(controller.signal.aborted ? 'gmail_timeout' : 'gmail_network_error');
  } finally { clearTimeout(timer); }
}

function validId(id: string) { return /^[a-zA-Z0-9_-]{1,200}$/.test(id); }
function decodeBody(data: string, maxBytes: number) {
  if (data.length > Math.ceil(maxBytes * 4 / 3) + 8 || !/^[\w-]*={0,2}$/.test(data)) throw new JobMailApiError('gmail_response_too_large');
  const bytes = Buffer.from(data, 'base64url');
  if (bytes.length > maxBytes) throw new JobMailApiError('gmail_response_too_large');
  return bytes;
}
export function emailAddresses(value: string) {
  return [...new Set((value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((item) => item.toLowerCase()))].slice(0, 30);
}

export function parseJobGmailMessage(payload: GmailFullMessage): JobMailMessage {
  if (!payload.id || !validId(payload.id) || !payload.threadId || !validId(payload.threadId)) throw new JobMailApiError('gmail_response_invalid');
  const timestamp = Number(payload.internalDate);
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > Date.now() + 300_000) throw new JobMailApiError('gmail_response_invalid');
  const header = (key: string) => (payload.payload?.headers || []).find((item) => item.name?.toLowerCase() === key)?.value || '';
  const plain: string[] = [];
  const html: string[] = [];
  const pdfAttachments: JobMailPdfAttachment[] = [];
  let count = 0;
  const visit = (part: GmailPart, depth: number) => {
    if (++count > 100 || depth > 10) throw new JobMailApiError('gmail_response_invalid');
    if (part.filename && part.body?.attachmentId && part.mimeType === 'application/pdf' && part.body.size && part.body.size <= jobPdfLimits.maxBytes && validId(part.body.attachmentId) && pdfAttachments.length < 5) pdfAttachments.push({ attachmentId: part.body.attachmentId, filename: part.filename.replace(/[\x00-\x1f\x7f\\/]/g, '_').slice(0, 180), mime: 'application/pdf', size: part.body.size });
    if (!part.filename && part.body?.data && ['text/plain', 'text/html'].includes(part.mimeType || '')) {
      const value = decodeBody(part.body.data, 250_000).toString('utf8').replace(/\u0000/g, '');
      (part.mimeType === 'text/plain' ? plain : html).push(value);
    }
    for (const child of part.parts || []) visit(child, depth + 1);
  };
  if (payload.payload) visit(payload.payload, 0);
  // HTML is reduced to inert plain text; remote images, hrefs, CSS and scripts are never rendered/fetched.
  const text = (plain.length ? plain.join('\n') : html.join('\n').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?\s*>|<\/p>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')).trim().slice(0, 30_000);
  return { messageId: payload.id, threadId: payload.threadId, occurredAt: new Date(timestamp).toISOString(), subject: header('subject').replace(/[\r\n]/g, ' ').slice(0, 300), text, sender: emailAddresses(header('from'))[0] || '', recipients: emailAddresses(`${header('to')} ${header('cc')}`), direction: payload.labelIds?.includes('SENT') ? 'OUTBOUND' : 'INBOUND', pdfAttachments };
}

export async function listJobGmailLabels(token: string, transport?: JobMailTransport) {
  const result = await requestJson<{ labels?: Array<{ id?: string; name?: string; type?: string }> }>(token, '/labels', transport);
  return (result.labels || []).filter((item) => item.id && validId(item.id) && item.type === 'user').map((item) => ({ id: item.id!, name: String(item.name || '').slice(0, 180) }));
}
export async function listScopedJobGmailMessages(token: string, input: { labelIds: string[]; since: string; limit: number; pageTokens?: Record<string, string> }, transport?: JobMailTransport) {
  if (!input.labelIds.length || input.labelIds.length > 5 || !input.labelIds.every(validId) || !/^20\d{2}-\d{2}-\d{2}$/.test(input.since)) throw new JobMailApiError('gmail_response_invalid');
  const after = Math.floor(Date.parse(`${input.since}T00:00:00Z`) / 1000);
  if (!Number.isFinite(after)) throw new JobMailApiError('gmail_response_invalid');
  const ids = new Set<string>();
  const limit = Math.max(1, Math.min(25, Math.floor(input.limit)));
  const pageTokens: Record<string, string> = {};
  // Gmail's repeated labelIds means AND, so query each approved label separately and deduplicate the union.
  for (const labelId of input.labelIds) {
    const params = new URLSearchParams({ labelIds: labelId, q: `after:${after}`, maxResults: String(Math.max(1, Math.floor(limit / input.labelIds.length))), includeSpamTrash: 'false' });
    const previousPageToken = input.pageTokens?.[labelId];
    if (previousPageToken && /^[\w=-]{1,1000}$/.test(previousPageToken)) params.set('pageToken', previousPageToken);
    const result = await requestJson<{ messages?: Array<{ id?: string }>; nextPageToken?: string }>(token, `/messages?${params}`, transport);
    for (const item of result.messages || []) if (item.id && validId(item.id) && ids.size < limit) ids.add(item.id);
    pageTokens[labelId] = result.nextPageToken && /^[\w=-]{1,1000}$/.test(result.nextPageToken) ? result.nextPageToken : '';
  }
  return { messageIds: [...ids], pageTokens };
}
export async function readJobGmailMessage(token: string, messageId: string, transport?: JobMailTransport, requiredLabelIds?: string[]) {
  if (!validId(messageId)) throw new JobMailApiError('gmail_response_invalid');
  const message = await requestJson<GmailFullMessage>(token, `/messages/${encodeURIComponent(messageId)}?format=full`, transport);
  if (requiredLabelIds?.length && !requiredLabelIds.some((id) => message.labelIds?.includes(id))) return null;
  return parseJobGmailMessage(message);
}
export async function readJobGmailPdfAttachment(token: string, messageId: string, attachment: JobMailPdfAttachment, transport?: JobMailTransport) {
  if (!validId(messageId) || !validId(attachment.attachmentId) || attachment.size > jobPdfLimits.maxBytes) throw new JobMailApiError('gmail_response_invalid');
  const result = await requestJson<{ data?: string; size?: number }>(token, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.attachmentId)}`, transport);
  const bytes = decodeBody(result.data || '', jobPdfLimits.maxBytes);
  if (!result.size || bytes.length !== result.size || bytes.length !== attachment.size || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new JobMailApiError('gmail_response_invalid');
  return bytes;
}
