import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { addAuditLog, listBusinessFinanceEvidence } from '@/src/server/db';

export const dynamic = 'force-dynamic';

function cell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin();
  const type = request.nextUrl.searchParams.get('type') === 'payments' ? 'payments' : 'invoices';
  const rawYear = request.nextUrl.searchParams.get('year') || '';
  const year = /^20\d{2}$/.test(rawYear) ? rawYear : '';
  const { invoices, paymentEvents } = await listBusinessFinanceEvidence();

  const rows = type === 'invoices'
    ? invoices.filter((item) => !year || item.issuedOn.startsWith(year)).map((item) => [
      item.invoiceNumber, item.jobId, item.issuedOn, item.dueOn || '', item.amountWithoutVatCents / 100,
      item.vatRateBasisPoints / 100, item.amountWithVatCents / 100, item.cancelledAt ? 'stornovaná' : 'aktívna',
      item.cancelledOn || '', item.cancelReasonCode || '',
    ])
    : paymentEvents.filter((item) => !year || item.occurredOn.startsWith(year)).map((item) => [
      item.id, item.jobId, item.invoiceId || '', item.occurredOn,
      item.eventType === 'RECEIPT' ? 'prijatá úhrada' : 'storno úhrady',
      item.amountCents / 100, item.method, item.reference, item.reversalOf || '', item.reasonCode || '',
    ]);
  if (rows.length > 10_000) return NextResponse.json({ error: 'Export obsahuje viac ako 10 000 záznamov. Zvoľte konkrétny rok.' }, { status: 413 });

  const header = type === 'invoices'
    ? ['číslo faktúry', 'ID zákazky', 'vystavená', 'splatnosť', 'suma bez DPH', 'DPH %', 'suma s DPH', 'stav', 'dátum storna', 'dôvod storna']
    : ['ID udalosti', 'ID zákazky', 'ID faktúry', 'dátum udalosti', 'typ udalosti', 'suma', 'spôsob', 'referencia', 'storno pôvodnej udalosti', 'dôvod opravy'];
  await addAuditLog('system', 'business_finance', 'business_finance_exported', admin.email, { type, year: year || 'all', resultCount: rows.length });
  const csv = [header, ...rows].map((row) => row.map(cell).join(';')).join('\n');
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="astana-${type === 'invoices' ? 'faktury' : 'uhrady'}${year ? `-${year}` : ''}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
