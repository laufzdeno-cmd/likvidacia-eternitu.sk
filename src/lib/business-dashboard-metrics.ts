import type { BusinessJob } from '@/src/server/types';

export function summarizeBusinessJobs(jobs: BusinessJob[]) {
  const cancelledJobs = jobs.filter((job) => job.status === 'ZRUSENA');
  const activeJobs = jobs.filter((job) => job.status !== 'ZRUSENA');
  const sum = (items: BusinessJob[], select: (job: BusinessJob) => number) => items.reduce((total, job) => total + select(job), 0);
  const recordedOrderValue = sum(activeJobs, (job) => job.totalPrice);
  const invoiceTypeValue = sum(activeJobs.filter((job) => job.paymentType === 'FAKTURA'), (job) => job.totalPrice);
  const cashTypeValue = sum(activeJobs.filter((job) => job.paymentType === 'CASH'), (job) => job.totalPrice);
  const area = sum(activeJobs, (job) => job.m2);
  const rewards = sum(activeJobs, (job) => job.rewardsTotal);
  const directCosts = sum(activeJobs, (job) => job.costs.total);
  const preOverheadRemainder = sum(activeJobs, (job) => job.totalPrice - job.rewardsTotal - job.costs.total);

  return {
    activeJobs,
    jobsWithoutKnownPrice: activeJobs.filter((job) => job.totalPriceKnown === false).length,
    cancelledJobs,
    recordedOrderValue,
    cancelledValue: sum(cancelledJobs, (job) => job.totalPrice),
    invoiceTypeValue,
    cashTypeValue,
    area,
    wasteKg: sum(activeJobs, (job) => job.wasteKg),
    rewards,
    directCosts,
    preOverheadRemainder,
    jobsWithoutRecordedDirectCosts: activeJobs.filter((job) => job.costs.total === 0 && job.rewardsTotal === 0).length,
    averageRecordedPricePerM2: area > 0 ? recordedOrderValue / area : null,
  };
}

export function summarizeOfferEvents(
  offers: Array<{ createdAt: string; sentAt?: string; acceptedAt?: string }>,
  from: string,
  to: string,
  isInPeriod: (value: string | undefined, from: string, to: string) => boolean,
) {
  return {
    created: offers.filter((offer) => isInPeriod(offer.createdAt, from, to)).length,
    sent: offers.filter((offer) => isInPeriod(offer.sentAt, from, to)).length,
    accepted: offers.filter((offer) => isInPeriod(offer.acceptedAt, from, to)).length,
  };
}
