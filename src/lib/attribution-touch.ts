export type CampaignTouch = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  utmId?: string;
  landingPath?: string;
  gclid?: string;
  fbclid?: string;
  gbraid?: string;
  wbraid?: string;
};

const campaignKeys: Array<keyof CampaignTouch> = [
  'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'utmId', 'gclid', 'fbclid', 'gbraid', 'wbraid',
];

const campaignParameterMap = [
  ['utm_source', 'utmSource', 160, 'analytics'],
  ['utm_medium', 'utmMedium', 160, 'analytics'],
  ['utm_campaign', 'utmCampaign', 160, 'analytics'],
  ['utm_content', 'utmContent', 160, 'analytics'],
  ['utm_term', 'utmTerm', 160, 'analytics'],
  ['utm_id', 'utmId', 160, 'analytics'],
  ['gclid', 'gclid', 512, 'marketing'],
  ['fbclid', 'fbclid', 512, 'marketing'],
  ['gbraid', 'gbraid', 512, 'marketing'],
  ['wbraid', 'wbraid', 512, 'marketing'],
] as const;

/** Keep one complete campaign touch; never combine fields from unrelated visits. */
export function selectCampaignTouch(existing: CampaignTouch, current: CampaignTouch): CampaignTouch {
  if (campaignKeys.some((key) => Boolean(current[key]))) return { ...current };
  return { ...existing };
}

/** Carry only consented, bounded campaign fields over a same-origin link to the form. */
export function carryConsentedCampaignParameters(
  sourceUrl: URL,
  targetUrl: URL,
  consent: { analytics: boolean; marketing: boolean },
): boolean {
  if (!consent.analytics || sourceUrl.origin !== targetUrl.origin) return false;
  const sourceParams = sourceUrl.searchParams;
  const targetParams = targetUrl.searchParams;
  let hasCampaign = false;
  for (const [parameter, , maximumLength, category] of campaignParameterMap) {
    if (category === 'marketing' && !consent.marketing) continue;
    const value = sourceParams.get(parameter)?.trim();
    if (!value || value.length > maximumLength || /[\r\n\u0000-\u001f\u007f]/u.test(value)) continue;
    hasCampaign = true;
    if (!targetParams.has(parameter)) targetParams.set(parameter, value);
  }
  if (!hasCampaign) return false;

  const existingLanding = sourceParams.get('astana_landing');
  const landingPath = existingLanding && /^\/(?!\/)[A-Za-z0-9._~/%-]{0,299}$/u.test(existingLanding)
    ? existingLanding
    : `${sourceUrl.pathname}${sourceUrl.pathname.endsWith('/') ? '' : '/'}`.slice(0, 300);
  if (!targetParams.has('astana_landing')) targetParams.set('astana_landing', landingPath);
  return true;
}
