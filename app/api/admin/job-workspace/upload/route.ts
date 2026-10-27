import { currentAdminUser, verifyCsrf } from '@/src/server/auth';
import { registerJobPrivateDocument } from '@/src/server/job-workspace-db';
import { privateDocumentPublicView, storeJobPrivateUpload } from '@/src/server/job-private-storage';

export const runtime = 'nodejs';
export const maxDuration = 45;
const maxRequestBytes = 3 * 1024 * 1024 + 64 * 1024;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

async function boundedFormData(request: Request) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (declaredLength > maxRequestBytes) throw new Error('too_large');
  if (!request.body) throw new Error('empty');
  const reader = request.body.getReader();
  let length = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > maxRequestBytes) { await reader.cancel(); throw new Error('too_large'); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(Buffer.concat(parts, length));
  return new Request('http://private-upload.invalid', { method: 'POST', headers: { 'content-type': request.headers.get('content-type') || '' }, body }).formData();
}

export async function POST(request: Request) {
  const user = await currentAdminUser();
  if (!user?.active) return Response.json({ error: 'Prihláste sa do administrácie.' }, { status: 401, headers });
  if (!['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) return Response.json({ error: 'Nemáte oprávnenie na súkromné prílohy.' }, { status: 403, headers });
  try {
    const form = await boundedFormData(request);
    await verifyCsrf(form);
    const file = form.get('file');
    const kind = String(form.get('kind') || 'PDF');
    if (!(file instanceof File) || !['PDF', 'PHOTO', 'AUTHORITY'].includes(kind)) return Response.json({ error: 'Vyberte PDF alebo fotografiu.' }, { status: 400, headers });
    const result = await storeJobPrivateUpload({ bytes: new Uint8Array(await file.arrayBuffer()), originalName: file.name, mime: file.type, kind: kind as 'PDF' | 'PHOTO' | 'AUTHORITY', jobId: String(form.get('jobId') || '') || null }, user, { register: registerJobPrivateDocument });
    return Response.json({ document: privateDocumentPublicView(result.document), extraction: result.extraction }, { status: 201, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'too_large') return Response.json({ error: 'Súbor môže mať najviac 3 MB.' }, { status: 413, headers });
    // Do not leak SQL, storage paths, provider messages, credentials or uploaded content.
    const allowed = ['PDF môže mať najviac 3 MB.', 'Súbor nie je platný PDF dokument.', 'Fotografia môže mať najviac 3 MB.', 'Vyberte fotografiu JPG, PNG alebo WebP.', 'Vyberte PDF dokument.', 'Neplatná zákazka.', 'Neplatný bezpečnostný token. Obnovte stránku a skúste to znova.'];
    return Response.json({ error: allowed.includes(message) ? message : 'Súkromnú prílohu sa nepodarilo uložiť. Skontrolujte súbor a skúste to znova.' }, { status: 400, headers });
  }
}
