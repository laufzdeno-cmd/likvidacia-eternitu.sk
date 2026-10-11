type TrackingWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  oaiq?: ((...args: unknown[]) => void) & { q?: unknown[][] };
};

type AcceptedLeadConversion = {
  eventId: string;
  material: 'vlnity' | 'plocha' | 'iny' | 'neviem';
};

type TrackingDependencies = {
  window: TrackingWindow;
  document: Document;
  hasMarketingConsent: () => boolean;
  metaPixelId?: string;
  googleAdsConversionId?: string;
  googleAdsConversionLabel?: string;
  openAiAdsPixelId?: string;
  openAiAdsDebug?: boolean;
};

export function publishAcceptedLeadConversion(detail: AcceptedLeadConversion): void;

export function publishAcceptedLeadResponse(result: {
  ok?: boolean;
  metaLead?: AcceptedLeadConversion;
} | null | undefined): void;

export function attachAcceptedLeadConversionTracking(dependencies: TrackingDependencies): () => void;

export function createDeferredAdConversionTrackingFacade(options?: {
  loadEngine?: () => Promise<{
    attachAcceptedLeadConversionTracking: (dependencies: TrackingDependencies) => () => void;
    publishAcceptedLeadConversion: (detail: AcceptedLeadConversion) => void;
  }>;
  maximumQueuedEvents?: number;
}): {
  attachAcceptedLeadConversionTracking: (dependencies: TrackingDependencies) => () => void;
  publishAcceptedLeadConversion: (detail: AcceptedLeadConversion) => void;
  publishAcceptedLeadResponse: (result: { ok?: boolean; metaLead?: AcceptedLeadConversion } | null | undefined) => void;
  waitForEngine: () => Promise<unknown>;
};
