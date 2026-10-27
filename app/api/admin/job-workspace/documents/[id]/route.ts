import { currentAdminUser } from '@/src/server/auth';
import { getJobPrivateDocument } from '@/src/server/job-workspace-db';
import { readJobPrivateBytes } from '@/src/server/job-private-storage';
import { createHash } from 'node:crypto';
import { verifiedImageMime } from '@/src/server/photo-intake-policy';
import { jobWorkspaceEnabled, jobWorkspaceUnavailableMessage } from '@/src/server/job-workspace-feature';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentAdminUser();
  const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
  if (!user?.active) return new Response('Neprihlásené', { status: 401, headers });
  if (!['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) return new Response('Zakázané', { status: 403, headers });
  if (!jobWorkspaceEnabled()) return new Response(jobWorkspaceUnavailableMessage, { status: 503, headers });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Nenájdené', { status: 404, headers });
  try {
    const document = await getJobPrivateDocument(id, user);
    if (!document) return new Response('Nenájdené', { status: 404, headers });
    const thumbnail = new URL(request.url).searchParams.get('thumbnail') === '1';
    const storageKey = thumbnail ? document.thumbnailStorageKey : document.storageKey;
    if (!storageKey) return new Response('Nenájdené', { status: 404, headers });
    const bytes = await readJobPrivateBytes(storageKey);
    const photo = document.kind === 'PHOTO';
    if (photo && verifiedImageMime(bytes) !== 'image/webp') return new Response('Neplatný súbor', { status: 415, headers });
    if (!photo && Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') return new Response('Neplatný súbor', { status: 415, headers });
    if (!thumbnail && createHash('sha256').update(bytes).digest('hex') !== document.sha256) return new Response('Neplatný súbor', { status: 415, headers });
    const fileName = photo ? `fotografia-${id}.webp` : `dokument-${id}.pdf`;
    const downloadName = photo ? `${document.fileName.replace(/\.[^.]{1,8}$/, '')}.webp` : document.fileName;
    return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Type': photo ? 'image/webp' : 'application/pdf', 'Content-Length': String(bytes.byteLength), 'Content-Disposition': `${photo ? 'inline' : 'attachment'}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}` } });
  } catch { return new Response('Súkromný súbor nie je dostupný.', { status: 404, headers }); }
}
