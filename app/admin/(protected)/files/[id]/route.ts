import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/src/server/auth';
import { getLeadFile } from '@/src/server/db';
import { readStoredLeadFile } from '@/src/server/storage';
import { detectLeadFileContentType } from '@/src/server/file-validation';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const file = await getLeadFile(id);
  if (!file) return new NextResponse('Not found', { status: 404 });
  const bytes = await readStoredLeadFile(file);
  const mimeType = detectLeadFileContentType(new Uint8Array(bytes.subarray(0, 32)));
  if (!mimeType) return new NextResponse('Unsupported file type', { status: 415 });
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="priloha"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cache-Control': 'private, no-store',
    },
  });
}
