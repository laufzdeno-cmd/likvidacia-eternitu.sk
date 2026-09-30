import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/src/server/auth';
import { getCareerApplication } from '@/src/server/db';
import { readStoredCareerApplicationCv } from '@/src/server/storage';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const application = await getCareerApplication(id);
  if (!application?.cv) return new NextResponse('Not found', { status: 404 });
  const bytes = await readStoredCareerApplicationCv(application.cv);
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': application.cv.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(application.cv.originalName)}"`,
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cache-Control': 'private, no-store',
    },
  });
}
