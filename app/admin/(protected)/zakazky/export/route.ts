import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { addAuditLog, countBusinessJobs, listBusinessJobs } from '@/src/server/db';
import { csvCell } from '@/src/server/csv';
import { jobStatusLabels, jobStatuses, landfillLabels, landfills, paymentLabels, paymentTypes, workTypeLabels } from '../constants';
import type { BusinessJobStatus, BusinessLandfill, BusinessPaymentType } from '@/src/server/types';

export async function GET(request: NextRequest) {
  const adminUser = await requireSuperAdmin();
  const params = request.nextUrl.searchParams;
  const rawMonth = params.get('month') || '';
  if (rawMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)) {
    return NextResponse.json({ error: 'Neplatné obdobie exportu.' }, { status: 400 });
  }
  const month = rawMonth;
  const statusValue = params.get('status') || '';
  const paymentValue = params.get('payment') || '';
  const landfillValue = params.get('landfill') || '';
  if ((statusValue && !jobStatuses.includes(statusValue as BusinessJobStatus))
    || (paymentValue && !paymentTypes.includes(paymentValue as BusinessPaymentType))
    || (landfillValue && !landfills.includes(landfillValue as BusinessLandfill))) {
    return NextResponse.json({ error: 'Niektorý filter exportu nie je platný.' }, { status: 400 });
  }
  const status = jobStatuses.includes(statusValue as BusinessJobStatus) ? statusValue as BusinessJobStatus : undefined;
  const paymentType = paymentTypes.includes(paymentValue as BusinessPaymentType) ? paymentValue as BusinessPaymentType : undefined;
  const landfill = landfills.includes(landfillValue as BusinessLandfill) ? landfillValue as BusinessLandfill : undefined;
  const includeArchived = adminUser.role === 'SUPER_ADMIN' && params.get('archived') === '1';
  const filters = {
    ...(month ? {
      from: `${month}-01`,
      to: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10),
    } : {}),
    includeArchived,
    status,
    paymentType,
    landfill,
    workerId: (params.get('worker') || '').slice(0, 80) || undefined,
    q: (params.get('q') || '').trim().slice(0, 120) || undefined,
    limit: null,
  };
  const matchingCount = await countBusinessJobs(filters);
  if (matchingCount > 10_000) {
    return NextResponse.json({ error: 'Export obsahuje viac ako 10 000 záznamov. Zúžte obdobie alebo filtre a skúste znova.' }, { status: 413 });
  }
  const jobs = await listBusinessJobs(filters);
  await addAuditLog('system', 'business_jobs', 'business_jobs_exported', adminUser.email, {
    month: month || 'all', status: status || 'all', paymentType: paymentType || 'all',
    landfill: landfill || 'all', includeArchived, resultCount: jobs.length,
  });
  const header = ['dátum', 'meno', 'lokalita', 'm2', 'evidovaná cena/m2', 'evidovaná suma', 'dohodnutý spôsob vyúčtovania (nie dôkaz úhrady)', 'typ práce', 'váha kg', 'skládka', 'tím', 'zadané odmeny', 'zadané priame náklady', 'orientačný rozdiel po zadaných nákladoch a odmenách', 'stav', 'archivované'];
  const lines = [
    header.join(';'),
    ...jobs.map((job) =>
      [
        job.demolitionDate,
        job.customerName,
        job.location,
        job.m2,
        job.pricePerM2,
        job.totalPrice,
        paymentLabels[job.paymentType],
        workTypeLabels[job.workType],
        job.wasteKg,
        landfillLabels[job.landfill],
        job.workers.map((worker) => worker.workerName).join(', '),
        job.rewardsTotal,
        job.costs.total,
        job.totalPrice - job.rewardsTotal - job.costs.total,
        jobStatusLabels[job.status],
        job.deletedAt ? 'áno' : 'nie',
      ].map(csvCell).join(';'),
    ),
  ];
  return new NextResponse(`\uFEFF${lines.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="astana-zakazky.csv"',
      'Cache-Control': 'private, no-store',
    },
  });
}
