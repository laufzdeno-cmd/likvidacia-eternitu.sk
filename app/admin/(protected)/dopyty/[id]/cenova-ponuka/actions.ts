'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/src/server/auth';
import { createQuote, nextQuoteNumber } from '@/src/server/db';
import { quoteSchema } from '@/src/server/validation';

export async function createQuoteAction(formData: FormData) {
  const actor = await requireAdmin();
  const leadId = String(formData.get('leadId') || '');
  const quoteNumber = String(formData.get('quoteNumber') || '') || (await nextQuoteNumber());
  const parsed = quoteSchema.safeParse({
    areaEstimate: formData.get('areaEstimate'),
    pricePerM2: formData.get('pricePerM2'),
    documentationFee: formData.get('documentationFee'),
    transportFee: formData.get('transportFee'),
    surcharge: formData.get('surcharge'),
    discount: formData.get('discount'),
    vatRate: formData.get('vatRate'),
    validUntil: formData.get('validUntil'),
    note: formData.get('note'),
  });

  if (!leadId || !parsed.success) {
    redirect(`/admin/dopyty/${leadId}`);
  }

  const quote = await createQuote({
    leadId,
    quoteNumber,
    validUntil: parsed.data.validUntil,
    areaEstimate: parsed.data.areaEstimate,
    pricePerM2: parsed.data.pricePerM2,
    documentationFee: parsed.data.documentationFee,
    transportFee: parsed.data.transportFee,
    surcharge: parsed.data.surcharge,
    discount: parsed.data.discount,
    vatRate: parsed.data.vatRate,
    note: parsed.data.note || '',
    createdBy: actor,
  });

  redirect(`/admin/cenove-ponuky/${quote.id}`);
}
