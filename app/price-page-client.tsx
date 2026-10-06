'use client';

import { useEffect } from 'react';
import { trackAnalyticsEvent } from '@/src/lib/analytics-client';
import { initializePriceCalculators } from '@/src/lib/price-calculator';

/** Activates the standalone price calculator with the shared analytics policy. */
export default function PricePageClient() {
  useEffect(() => initializePriceCalculators(trackAnalyticsEvent), []);

  return null;
}
