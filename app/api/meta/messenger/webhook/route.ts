import { NextResponse } from 'next/server';
import { getFacebookMessengerConfiguration, decryptFacebookPageToken } from '@/src/server/facebook-messenger-config';
import {
  getFacebookPageConnectionSecret,
  markFacebookDelivered,
  markFacebookReadByWatermark,
  recordFacebookWebhookSeen,
  storeFacebookInboundMessage,
  storeFacebookOutboundEcho,
  updateFacebookParticipantName,
} from '@/src/server/facebook-messenger-db';
import { fetchFacebookParticipantName } from '@/src/server/facebook-messenger-api';
import { facebookAttachmentTypes, facebookWebhookMaxBytes, verifyFacebookWebhookSignature, verifyFacebookWebhookToken } from '@/src/server/facebook-messenger-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const config = getFacebookMessengerConfiguration();
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (!config.verifyToken || mode !== 'subscribe' || !challenge || !verifyFacebookWebhookToken(token, config.verifyToken)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
function eventTime(value: unknown) {
  const timestamp = Number(value);
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function POST(request: Request) {
  const config = getFacebookMessengerConfiguration();
  if (!config.appSecret || !config.pageId || !config.encryptionKey) return NextResponse.json({ ok: false }, { status: 503 });
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > facebookWebhookMaxBytes) return NextResponse.json({ ok: false }, { status: 413 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > facebookWebhookMaxBytes) return NextResponse.json({ ok: false }, { status: 413 });
  if (!verifyFacebookWebhookSignature(rawBody, request.headers.get('x-hub-signature-256'), config.appSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (payload.object !== 'page' || !Array.isArray(payload.entry)) return NextResponse.json({ ok: true });
  const secret = await getFacebookPageConnectionSecret(config.pageId);
  if (!secret || secret.connection.pageId !== config.pageId) return NextResponse.json({ ok: false }, { status: 503 });
  const pageAccessToken = decryptFacebookPageToken(secret.encryptedPageAccessToken, config.encryptionKey);
  const participantsToEnrich = new Set<string>();
  for (const entry of payload.entry.slice(0, 100)) {
    if (!entry || typeof entry !== 'object') continue;
    const entryRecord = entry as Record<string, unknown>;
    if (String(entryRecord.id || '') !== config.pageId || !Array.isArray(entryRecord.messaging)) continue;
    for (const item of entryRecord.messaging.slice(0, 200)) {
      if (!item || typeof item !== 'object') continue;
      const event = item as Record<string, unknown>;
      const sender = event.sender as Record<string, unknown> | undefined;
      const recipient = event.recipient as Record<string, unknown> | undefined;
      const message = event.message as Record<string, unknown> | undefined;
      if (message?.mid) {
        const isEcho = message.is_echo === true;
        const participantId = String(isEcho ? recipient?.id || '' : sender?.id || '');
        const pageId = String(isEcho ? sender?.id || '' : recipient?.id || '');
        if (pageId !== config.pageId || !participantId) continue;
        const input = {
          pageId,
          participantId,
          providerMessageId: String(message.mid),
          text: typeof message.text === 'string' ? message.text : '',
          attachmentTypes: facebookAttachmentTypes(message.attachments),
          providerTimestamp: eventTime(event.timestamp),
        };
        const result = isEcho ? { inserted: await storeFacebookOutboundEcho(input) } : await storeFacebookInboundMessage(input);
        if (result.inserted && !isEcho) participantsToEnrich.add(participantId);
      }
      const delivery = event.delivery as Record<string, unknown> | undefined;
      if (delivery && Array.isArray(delivery.mids)) await markFacebookDelivered(delivery.mids.map(String));
      const read = event.read as Record<string, unknown> | undefined;
      if (read?.watermark && sender?.id) await markFacebookReadByWatermark(config.pageId, String(sender.id), String(read.watermark));
    }
  }
  await recordFacebookWebhookSeen(config.pageId);
  await Promise.all([...participantsToEnrich].slice(0, 20).map(async (participantId) => {
    try {
      const name = await fetchFacebookParticipantName(participantId, pageAccessToken);
      if (name) await updateFacebookParticipantName(config.pageId, participantId, name);
    } catch {
      // The message is already stored; profile enrichment is optional and safe to retry on a later message.
    }
  }));
  return NextResponse.json({ ok: true });
}
