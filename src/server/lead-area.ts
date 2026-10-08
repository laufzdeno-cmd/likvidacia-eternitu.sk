import type { Lead } from './types';

export const leadAreaUnknownCode = 'lead_area_unknown';

export function isLeadAreaUnknown(lead: Pick<Lead, 'rawData'>) {
  return lead.rawData?.areaEstimateStatus === leadAreaUnknownCode;
}

export function formatLeadArea(lead: Pick<Lead, 'areaEstimate' | 'rawData'>) {
  return isLeadAreaUnknown(lead) ? 'Neviem približnú výmeru' : `${lead.areaEstimate} m²`;
}

export function formatLeadAreaCompact(lead: Pick<Lead, 'areaEstimate' | 'rawData'>) {
  return isLeadAreaUnknown(lead) ? 'Výmera neznáma' : `${lead.areaEstimate} m²`;
}
