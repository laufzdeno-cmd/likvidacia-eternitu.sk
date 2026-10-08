type RuntimeEnvironment = Record<string, string | undefined>;

export type MetaCapiConfig = {
  pixelId: string;
  accessToken: string;
  apiVersion: string;
};

export function readMetaCapiConfig(environment: RuntimeEnvironment = process.env): MetaCapiConfig | null {
  const pixelId = environment.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';
  const accessToken = environment.META_CAPI_ACCESS_TOKEN?.trim() || '';
  const apiVersion = environment.META_GRAPH_API_VERSION?.trim() || '';
  const conversionEventSecret = environment.CONVERSION_EVENT_SECRET?.trim() || '';
  if (!/^\d{5,32}$/.test(pixelId) || !accessToken || !/^v\d+\.\d+$/.test(apiVersion) || !conversionEventSecret) return null;
  return { pixelId, accessToken, apiVersion };
}

export function isMetaCapiConfigured(environment: RuntimeEnvironment = process.env) {
  return Boolean(readMetaCapiConfig(environment));
}
