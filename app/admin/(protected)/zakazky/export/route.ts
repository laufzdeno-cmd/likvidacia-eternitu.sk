import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/src/server/auth';
import { listBusinessJobs } from '@/src/server/db';
import { jobStatusLabels, landfillLabels, paymentLabels, workTypeLabels } from '../constants';

function csvCell(value: string | number) {
  const text = String(value);
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: NextRequest) {
  await requireAdmin();
  const month = request.nextUrl.searchParams.get('month') || '';
  const bounds = month ? { from: `${month}-01`, to: new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10) } : {};
  const jobs = await listBusinessJobs(bounds);
  const header = ['dátum', 'meno', 'lokalita', 'm²', 'cena/m²', 'celkom €', 'platba', 'typ práce', 'váha kg', 'skládka', 'tím', 'odmeny', 'náklady', 'zisk €', 'stav'];
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
        job.grossProfit,
        jobStatusLabels[job.status],
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
