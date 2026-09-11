export type AnalyticsTouch = {
  source: string;
  medium: string;
  campaign: string;
};

export type AnalyticsAttribution = {
  firstTouch: AnalyticsTouch;
  lastTouch: AnalyticsTouch;
};

const storageKey = 'astana_analytics_attribution_v1';

const emptyTouch = (): AnalyticsTouch => ({ source: '', medium: '', campaign: '' });

function readStoredAttribution(): AnalyticsAttribution {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as Partial<AnalyticsAttribution> | null;
    return {
      firstTouch: { ...emptyTouch(), ...(parsed?.firstTouch || {}) },
      lastTouch: { ...emptyTouch(), ...(parsed?.lastTouch || {}) },
    };
  } catch {
    return { firstTouch: emptyTouch(), lastTouch: emptyTouch() };
  }
}

function currentTouch(): AnalyticsTouch {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source')?.trim() || '',
    medium: params.get('utm_medium')?.trim() || '',
    campaign: params.get('utm_campaign')?.trim() || '',
  };
}

function hasTouchData(touch: AnalyticsTouch) {
  return Boolean(touch.source || touch.medium || touch.campaign);
}

export function getAnalyticsAttribution(): AnalyticsAttribution {
  const stored = readStoredAttribution();
  const current = currentTouch();
  const hasCurrent = hasTouchData(current);
  const attribution: AnalyticsAttribution = {
    firstTouch: hasTouchData(stored.firstTouch) ? stored.firstTouch : hasCurrent ? current : stored.firstTouch,
    lastTouch: hasCurrent ? current : hasTouchData(stored.lastTouch) ? stored.lastTouch : stored.firstTouch,
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(attribution));
  } catch {
    // Private browsing can block storage; the event still carries the current URL values.
  }

  return attribution;
}
