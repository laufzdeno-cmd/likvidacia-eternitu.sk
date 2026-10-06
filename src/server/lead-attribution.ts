import { z } from 'zod';

const campaignValue = z.string().max(160)
  .refine((value) => !/[\r\n]/u.test(value))
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(160).regex(/^[\p{L}\p{N}._~%+/|:,&'’()\-–— ]+$/u));
const clickIdValue = z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9._~%+=/-]+$/);
const landingPathValue = z.string().trim().min(1).max(300).regex(/^\/(?!\/)[A-Za-z0-9._~/%-]*$/);

const submittedLeadAttributionSchema = z.object({
  utmSource: campaignValue.optional(),
  utmMedium: campaignValue.optional(),
  utmCampaign: campaignValue.optional(),
  utmContent: campaignValue.optional(),
  utmTerm: campaignValue.optional(),
  utmId: campaignValue.optional(),
  landingPath: landingPathValue.optional(),
  gclid: clickIdValue.optional(),
  fbclid: clickIdValue.optional(),
  gbraid: clickIdValue.optional(),
  wbraid: clickIdValue.optional(),
}).strict();

export type LeadAttribution = z.infer<typeof submittedLeadAttributionSchema>;

export function parseLeadAttribution(
  rawValue: unknown,
  consent: { analytics: boolean; marketing: boolean },
): LeadAttribution | undefined {
  if (typeof rawValue !== 'string' || rawValue.length > 8192) return undefined;

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawValue);
  } catch {
    return undefined;
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return undefined;
  const record = decoded as Record<string, unknown>;
  const shapes = submittedLeadAttributionSchema.shape;
  if (Object.keys(record).some((key) => !Object.hasOwn(shapes, key))) return undefined;
  const valid: Record<string, string> = {};
  for (const key of Object.keys(shapes) as Array<keyof typeof shapes>) {
    if (record[key] === undefined) continue;
    const field = shapes[key].safeParse(record[key]);
    if (field.success && typeof field.data === 'string') valid[key] = field.data;
  }

  const attribution: LeadAttribution = {};
  if (consent.analytics) {
    if (valid.utmSource) attribution.utmSource = valid.utmSource;
    if (valid.utmMedium) attribution.utmMedium = valid.utmMedium;
    if (valid.utmCampaign) attribution.utmCampaign = valid.utmCampaign;
    if (valid.utmContent) attribution.utmContent = valid.utmContent;
    if (valid.utmTerm) attribution.utmTerm = valid.utmTerm;
    if (valid.utmId) attribution.utmId = valid.utmId;
    if (valid.landingPath) attribution.landingPath = valid.landingPath;
  }
  if (consent.analytics && consent.marketing) {
    if (valid.gclid) attribution.gclid = valid.gclid;
    if (valid.fbclid) attribution.fbclid = valid.fbclid;
    if (valid.gbraid) attribution.gbraid = valid.gbraid;
    if (valid.wbraid) attribution.wbraid = valid.wbraid;
  }

  return Object.keys(attribution).length ? attribution : undefined;
}
