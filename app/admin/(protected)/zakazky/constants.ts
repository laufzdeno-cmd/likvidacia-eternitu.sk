import type { BusinessJobStatus, BusinessLandfill, BusinessPaymentType, BusinessWorkType } from '@/src/server/types';

export const jobStatusLabels: Record<BusinessJobStatus, string> = {
  DOPYT: 'Dopyt',
  PONUKA_ODOSLANA: 'Ponuka odoslaná',
  PRIJATA: 'Prijatá',
  V_REALIZACII: 'V realizácii',
  DOKONCENA: 'Dokončená',
  ZRUSENA: 'Zrušená',
};

export const paymentLabels: Record<BusinessPaymentType, string> = {
  FAKTURA: 'Faktúra',
  CASH: 'Cash',
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

export const jobStatuses = Object.keys(jobStatusLabels) as BusinessJobStatus[];
export const paymentTypes = Object.keys(paymentLabels) as BusinessPaymentType[];
export const workTypes = Object.keys(workTypeLabels) as BusinessWorkType[];
export const landfills = Object.keys(landfillLabels) as BusinessLandfill[];

export function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

export function numberSk(value: number, suffix = '') {
  return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 }).format(value || 0)}${suffix}`;
}
