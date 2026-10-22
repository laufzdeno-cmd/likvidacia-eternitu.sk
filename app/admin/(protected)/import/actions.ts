'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { listLandfillPrices, listWorkers } from '@/src/server/db';
import { parseImportCsv } from './csv-import';
import { importJobsAtomically } from './import-storage';

export type ImportActionState = {
  status: 'idle' | 'error' | 'success';
  message: string;
  errors: string[];
};

export async function importBusinessJobsAction(_state: ImportActionState, formData: FormData): Promise<ImportActionState> {
  await verifyCsrf(formData);
  const actor = (await requireSuperAdmin()).email;
  const csv = formData.get('csv');
  if (typeof csv !== 'string') {
    return { status: 'error', message: 'CSV obsah chýba.', errors: [] };
  }
  try {
    const [workers, prices] = await Promise.all([listWorkers(true), listLandfillPrices()]);
    const preview = parseImportCsv(csv, workers.map((worker) => worker.name));
    const errors = [...preview.errors, ...preview.rows.flatMap((row) => row.errors.map((error) => `Riadok ${row.line}: ${error}`))];
    if (errors.length) return { status: 'error', message: 'Import bol zrušený. Opravte všetky chyby v CSV.', errors };
    const result = await importJobsAtomically(preview.rows.map((row) => row.job!), workers, prices, actor);
    revalidatePath('/admin/import');
    revalidatePath('/admin/zakazky');
    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/rok');
    return {
      status: 'success',
      message: `Import dokončený: ${result.imported} nových zákaziek, ${result.alreadyImported} už importovaných.`,
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error && [
      'Hromadný import vyžaduje databázu PostgreSQL.',
      'Databázový prístup nie je v tomto prostredí povolený.',
      'Cena alebo náklady presahujú povolený rozsah.',
      'Identifikátor importu už patrí inej zákazke. Import bol zrušený.',
      'Rovnaká historická zákazka už môže existovať zo staršieho importu. Skontrolujte ju ručne.',
    ].includes(error.message) ? error.message : 'Import zlyhal. Skontrolujte zákazky a skúste to znova; opakovanie rovnakého CSV nevytvorí duplicity.';
    return { status: 'error', message, errors: [] };
  }
}
