import type { Lead } from './types';

/**
 * A value used only in lead.rawData when a visitor explicitly says they do
 * not know the approximate roof area. The numeric database column keeps 0 as
 * a technical sentinel; every customer- and operator-facing surface must use
 * the helpers below rather than render that sentinel as a real area.
 */
export const leadAreaUnknownCode = 'lead_area_unknown';

export function isLeadAreaUnknown(lead: Pick<Lead, 'rawData'>) {
  return lead.rawData?.areaEstimateStatus === leadAreaUnknownCode;
}

export function formatLeadArea(lead: Pick<Lead, 'areaEstimate' | 'rawData'>) {
  if (isLeadAreaUnknown(lead)) return 'Neviem približnú výmeru';
  return `${lead.areaEstimate} m2`;
}

export function formatLeadAreaCompact(lead: Pick<Lead, 'areaEstimate' | 'rawData'>) {
  if (isLeadAreaUnknown(lead)) return 'Výmera neznáma';
  return `${lead.areaEstimate} m2`;
}
