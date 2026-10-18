import type { OperationalBusinessJob } from '@/src/server/types';

/**
 * Minimal job projection that may cross the Server Component boundary into
 * PriceOfferForm. Keep this allowlist explicit so new operational or finance
 * fields can never be serialized to the browser by accident.
 */
export type PriceOfferJobOption = Pick<OperationalBusinessJob,
  'id' | 'customerName' | 'customerPhone' | 'customerEmail' | 'location'
  | 'district' | 'materialType' | 'objectType' | 'term' | 'leadSource' | 'm2'
>;

export function toPriceOfferJobOption(job: PriceOfferJobOption): PriceOfferJobOption {
  return {
    id: job.id,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    customerEmail: job.customerEmail,
    location: job.location,
    district: job.district,
    materialType: job.materialType,
    objectType: job.objectType,
    term: job.term,
    leadSource: job.leadSource,
    m2: job.m2,
  };
}
