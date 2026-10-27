import 'server-only';

import type { AdminDraftType } from '@/src/lib/admin-draft';

export type AdminDraftProviderStatus = {
  mode: 'ai' | 'deterministic';
  flagEnabled: boolean;
  providerReady: boolean;
  label: string;
  detail: string;
};

export function redactAdminDraftInput(value: string, maxLength = 2_000) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL ODSTRÁNENÝ]')
    .replace(/https?:\/\/\S+/gi, '[ODKAZ ODSTRÁNENÝ]')
    .replace(/(?:\+?\d[\s()./-]*){9,}/g, '[TELEFÓN ODSTRÁNENÝ]')
    .replace(/\b\d{3}\s?\d{2}\b/g, '[PSČ ODSTRÁNENÉ]')
    .replace(/\b(?:ulica|ul\.|námestie|nám\.|cesta)\s+[\p{L} .'-]{2,60}\s+\d{1,4}(?:[\/-]\d{1,4})?/giu, '[PRESNÁ ADRESA ODSTRÁNENÁ]')
    .replace(/\s{3,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function getAdminDraftProviderStatus(): AdminDraftProviderStatus {
  // Owner policy, 2026-10-27: private CRM content must never leave operational services for AI.
  // An old environment flag cannot override this boundary.
  return {
    mode: 'deterministic',
    flagEnabled: false,
    providerReady: false,
    label: 'Súkromná pracovná šablóna',
    detail: 'Text vzniká z miestnej šablóny. Obsah zákaziek, ponúk ani komunikácie sa neposiela externým AI službám.',
  };
}

export async function generateAdminDraftWithProvider(input: {
  type: AdminDraftType;
  name: string;
  locality: string;
  facts: string;
}, fetchImpl: typeof fetch = fetch): Promise<{ draft: string; model: string; redactionApplied: boolean }> {
  void input;
  void fetchImpl;
  throw new Error('Externé AI spracovanie je podľa pravidiel ochrany firemných údajov vypnuté. Použite miestnu šablónu.');
}
