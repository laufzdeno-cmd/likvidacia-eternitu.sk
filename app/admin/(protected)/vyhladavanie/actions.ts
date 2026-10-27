'use server';

import { z } from 'zod';
import { requireAdminUser, verifyCsrf } from '@/src/server/auth';
import { searchAdminRecords, type AdminSearchResult } from '@/src/server/admin-intelligence';

export type AdminSearchActionState = {
  query: string;
  error: string;
  result: AdminSearchResult | null;
};

const querySchema = z.string().trim().min(2).max(100);

export async function searchAdminRecordsAction(
  _previousState: AdminSearchActionState,
  formData: FormData,
): Promise<AdminSearchActionState> {
  await verifyCsrf(formData);
  const user = await requireAdminUser();
  const parsed = querySchema.safeParse(String(formData.get('q') || ''));
  if (!parsed.success) {
    return { query: '', error: 'Zadajte 2 až 100 znakov.', result: null };
  }
  const options = z.object({
    page: z.coerce.number().int().min(1).max(100000),
    year: z.union([z.literal(''), z.coerce.number().int().min(1900).max(2200)]),
    archived: z.enum(['exclude', 'include', 'only']),
    status: z.string().max(50),
    responsibleEmail: z.string().trim().max(200),
    workType: z.enum(['', 'DEMONTAZ', 'ODVOZ', 'DEMONTAZ_A_ODVOZ']),
  }).safeParse({ page: formData.get('page') || 1, year: formData.get('year') || '', archived: formData.get('archived') || 'exclude', status: formData.get('status') || '', responsibleEmail: formData.get('responsibleEmail') || '', workType: formData.get('workType') || '' });
  if (!options.success) return { query: parsed.data, error: 'Skontrolujte filtre vyhľadávania.', result: null };
  const { year, workType, ...filters } = options.data;
  const result = await searchAdminRecords(parsed.data, user.role, { ...filters, pageSize: 20, ...(year ? { year } : {}), ...(workType ? { workType } : {}) });
  return { query: parsed.data, error: '', result };
}
