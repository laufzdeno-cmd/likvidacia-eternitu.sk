import type { BusinessJobStatus, BusinessLandfill, BusinessPaymentType, BusinessWorkType } from '@/src/server/types';

export const workflowStatuses: BusinessJobStatus[] = [
  'DOPYT_PRIJATY',
  'PONUKA_ODOSLANA',
  'PONUKA_POTVRDENA',
  'URADY_PODANE',
  'URADY_SCHVALENE',
  'DEMONT_NAPLANOVANA',
  'DEMONT_DOKONCENA',
  'VYUCTOVANIE',
  'DOKONCENA',
];

export const jobStatusLabels: Record<BusinessJobStatus, string> = {
  DOPYT: 'Dopyt prijatý',
  DOPYT_PRIJATY: 'Dopyt prijatý',
  PONUKA_ODOSLANA: 'Ponuka odoslaná',
  PRIJATA: 'Ponuka potvrdená',
  PONUKA_POTVRDENA: 'Ponuka potvrdená',
  URADY_PODANE: 'Úrady podané',
  URADY_SCHVALENE: 'Úrady schválené',
  V_REALIZACII: 'Demontáž naplánovaná',
  DEMONT_NAPLANOVANA: 'Demontáž naplánovaná',
  DEMONT_DOKONCENA: 'Demontáž dokončená',
  VYUCTOVANIE: 'Vyúčtovanie',
  DOKONCENA: 'Dokončená',
  ZRUSENA: 'Zrušená',
};

export const jobStatuses: BusinessJobStatus[] = [...workflowStatuses, 'ZRUSENA'];

export function normalizeWorkflowStatus(status: BusinessJobStatus): BusinessJobStatus {
  if (status === 'DOPYT') return 'DOPYT_PRIJATY';
  if (status === 'PRIJATA') return 'PONUKA_POTVRDENA';
  if (status === 'V_REALIZACII') return 'DEMONT_NAPLANOVANA';
  return status;
}

export const paymentLabels: Record<BusinessPaymentType, string> = {
  FAKTURA: 'Faktúra',
  CASH: 'Hotovosť',
};

export const workTypeLabels: Record<BusinessWorkType, string> = {
  DEMONTAZ: 'Demontáž',
  ODVOZ: 'Odvoz',
  DEMONTAZ_A_ODVOZ: 'Demontáž + odvoz',
};

export const landfillLabels: Record<BusinessLandfill, string> = {
  MOCHOVCE: 'Mochovce',
  LIVINKE_OPATOVCE: 'Livinské Opatovce',
  KOSICE: 'Košice',
  INA: 'Iná',
};

export const paymentTypes = Object.keys(paymentLabels) as BusinessPaymentType[];
export const workTypes = Object.keys(workTypeLabels) as BusinessWorkType[];
export const landfills = Object.keys(landfillLabels) as BusinessLandfill[];

export function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

export function numberSk(value: number, suffix = '') {
  return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 }).format(value || 0)}${suffix}`;
}
