import { NextResponse } from 'next/server';
import { requireAdmin } from '@/src/server/auth';
import { getPriceOffer, getPriceOfferSettings } from '@/src/server/db';
import { renderPriceOfferPdf } from '@/src/server/price-offer-pdf';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [offer, settings] = await Promise.all([getPriceOffer(id), getPriceOfferSettings()]);
  if (!offer) return new NextResponse('Not found', { status: 404 });
  const pdf = await renderPriceOfferPdf(offer, settings);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="ASTANA-CP-${offer.number}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
