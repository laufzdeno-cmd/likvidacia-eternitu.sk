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
  const result = await searchAdminRecords(parsed.data, user.role);
  return { query: parsed.data, error: '', result };
}
