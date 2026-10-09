import { z } from 'zod';

export const publicAnalyticsEventTypes = [
  'page_view',
  'quote_section_view',
  'form_start',
  'form_submit_error',
  'cta_click',
  'phone_click',
  'price_calculator_change',
  'gallery_filter',
  'reviews_expand',
  'roofer_registration_success',
] as const;

const shortText = z.string().trim().max(160);
// Campaign fields have their own consent-gated channels. A CTA target must not
// retain a second copy of click IDs (or other query data) inside its URL.
function analyticsHrefWithoutQuery(href: string) {
  const query = href.indexOf('?');
  const hash = href.indexOf('#');
  if (query < 0 || (hash >= 0 && query > hash)) return href;
  return href.slice(0, query) + (hash >= 0 ? href.slice(hash) : '');
}

const adClickIdsSchema = z.strictObject({
  gclid: z.string().trim().min(1).max(512).optional(),
  fbclid: z.string().trim().min(1).max(512).optional(),
  gbraid: z.string().trim().min(1).max(512).optional(),
  wbraid: z.string().trim().min(1).max(512).optional(),
});

const metadataSchema = z.strictObject({
  form: z.enum(['lead', 'roofer_registration']).optional(),
  label: shortText.optional(),
  href: z.string().trim().max(16 * 1024).transform(analyticsHrefWithoutQuery).pipe(z.string().max(500)).optional(),
  gallery: z.enum(['home', 'realizacie']).optional(),
  category: shortText.optional(),
  material: shortText.optional(),
  area: z.string().trim().max(50).optional(),
  adClickIds: adClickIdsSchema.optional(),
});

export const publicAnalyticsPayloadSchema = z.strictObject({
  sessionId: z.string().uuid(),
  eventType: z.enum(publicAnalyticsEventTypes),
  path: z.string().trim().min(1).max(500).refine((value) => value.startsWith('/')),
  referrer: z.string().trim().max(500).optional().default(''),
  device: z.enum(['desktop', 'tablet', 'mobile']),
  viewportWidth: z.number().int().min(0).max(10_000).optional(),
  utmSource: shortText.optional().default(''),
  utmMedium: shortText.optional().default(''),
  utmCampaign: z.string().trim().max(160).optional().default(''),
  utmContent: shortText.optional(),
  utmTerm: shortText.optional(),
  utmId: shortText.optional(),
  landingPath: z.string().trim().min(1).max(300).regex(/^\/(?!\/)[^?#\\\s]*$/u).optional(),
  metadata: metadataSchema.optional().default({}),
});

export type PublicAnalyticsPayload = z.infer<typeof publicAnalyticsPayloadSchema>;

export function analyticsOriginAllowed(
  origin: string | null,
  nodeEnv: string | undefined,
  allowedOrigins = process.env.ALLOWED_ORIGINS,
) {
  if (!origin) return nodeEnv !== 'production';
  const allowed = (allowedOrigins || 'https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}
