'use client';

import { useEffect, useState } from 'react';
import { marketingConsent, revokePendingMetaCapiOutbox, saveMarketingConsent } from '@/src/lib/marketing-consent';

export function CookieConsentControls() {
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    setRevoked(marketingConsent() !== 'granted');
  }, []);

  const revoke = () => {
    saveMarketingConsent('denied');
    revokePendingMetaCapiOutbox();
    setRevoked(true);
  };

  const grant = () => {
    saveMarketingConsent('granted');
    setRevoked(false);
  };

  return (
    <div>
      <button className="button button-secondary" type="button" onClick={revoke} disabled={revoked}>
        {revoked ? 'Marketingové meranie je vypnuté' : 'Odvolať marketingové meranie'}
      </button>
      {revoked ? (
        <button className="button button-secondary" type="button" onClick={grant}>
          Povoliť marketingové meranie
        </button>
      ) : null}
      <p className="field-help">
        Odvolanie zastaví budúce Meta meranie v tomto prehliadači a zruší ešte neodoslané serverové meracie udalosti spojené s týmto súhlasom.
      </p>
    </div>
  );
}
