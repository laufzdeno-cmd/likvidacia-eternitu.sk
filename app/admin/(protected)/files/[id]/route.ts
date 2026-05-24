import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/src/server/auth';
import { getLeadFile } from '@/src/server/db';
import { readStoredLeadFile } from '@/src/server/storage';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const file = await getLeadFile(id);
  if (!file) return new NextResponse('Not found', { status: 404 });
  const bytes = await readStoredLeadFile(file);
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName)}"`,
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cache-Control': 'private, no-store',
    },
  });
}
