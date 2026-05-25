'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/src/server/auth';
import { listWorkers, saveBusinessJob } from '@/src/server/db';
import type { BusinessLandfill, BusinessPaymentType, BusinessWorkType } from '@/src/server/types';

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if ((char === ',' || char === ';') && !quoted) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function num(value: string) {
  return Number(String(value || '').replace(',', '.')) || 0;
}

export async function importBusinessJobsAction(formData: FormData) {
  const actor = (await requireSuperAdmin()).email;
  const csv = String(formData.get('csv') || '');
  const workers = await listWorkers(true);
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const dataLines = lines[0]?.toLowerCase().includes('datum') ? lines.slice(1) : lines;
  for (const line of dataLines) {
    const [datum, meno, lokalita, m2, cenaZaM2, platba, typPrace, vahaKg, skladka, pracovnici, nafta, obleky, rukavice, penetrak, ineNaklady] = parseCsvLine(line);
    if (!datum || !meno || !lokalita) continue;
    const selectedWorkers = pracovnici
      .split(';')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => workers.find((worker) => worker.name.localeCompare(name, 'sk', { sensitivity: 'base' }) === 0))
      .filter(Boolean);
    await saveBusinessJob(
      {
        demolitionDate: datum,
        customerName: meno,
        location: lokalita,
        m2: num(m2),
        pricePerM2: num(cenaZaM2),
        paymentType: (platba || 'FAKTURA') as BusinessPaymentType,
        workType: (typPrace || 'DEMONTAZ_A_ODVOZ') as BusinessWorkType,
        wasteKg: num(vahaKg),
        landfill: (skladka || 'INA') as BusinessLandfill,
        status: 'DOKONCENA',
        workers: selectedWorkers.map((worker) => ({ workerId: worker!.id })),
        costs: { fuel: num(nafta), suits: num(obleky), gloves: num(rukavice), penetrant: num(penetrak), landfillCost: 0, otherName: ineNaklady ? 'Iné náklady' : '', otherAmount: num(ineNaklady) },
      },
      actor,
    );
  }
  revalidatePath('/admin/import');
  revalidatePath('/admin/zakazky');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/rok');
}
