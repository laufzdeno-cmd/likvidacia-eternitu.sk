import { careerCvRetentionBound } from './career-cv-retention-binding';
import { leadBlobRetentionBound } from './lead-blob-retention-binding';
import { isMetaCapiConfigured } from './meta-capi-config';
import { getOpsAlertConfiguration } from './ops-alert-policy';
import {
  photoIntakeRetentionRequested,
  privatePhotoIntakeEnabled,
  privatePhotoIntakeStorageReady,
} from './photo-intake-config';
import { deploymentRequestBlocked } from './preview-safety';
import { getFacebookMessengerConfiguration } from './facebook-messenger-config';
import { getGmailPriceOfferConfiguration } from './gmail-price-offer-config';

type RuntimeEnvironment = Record<string, string | undefined>;

export type RuntimeFeatureState = {
  level: 'ok' | 'warning' | 'disabled';
  label: string;
  detail: string;
};

function scheduledWorkerReady(environment: RuntimeEnvironment) {
  const secret = environment.CRON_SECRET;
  if (!secret || secret !== secret.trim()) return false;
  return !deploymentRequestBlocked(
    environment,
    'GET',
    '/api/cron/runtime-feature-health/',
    'likvidacia-eternitu.sk',
  );
}

function leadRetentionState(environment: RuntimeEnvironment): RuntimeFeatureState {
  const s3Ready = Boolean(environment.S3_BUCKET && environment.S3_ACCESS_KEY_ID && environment.S3_SECRET_ACCESS_KEY);
  if (!environment.BLOB_READ_WRITE_TOKEN) {
    if (!s3Ready) {
      return { level: 'disabled', label: 'Nenastavená', detail: 'Chýba nakonfigurované súkromné úložisko príloh.' };
    }
    return scheduledWorkerReady(environment)
      ? { level: 'ok', label: 'Aktívna', detail: 'Súkromné prílohy majú zapnuté retenčné spracovanie.' }
      : { level: 'warning', label: 'Čaká na worker', detail: 'Úložisko je pripravené, ale plánované retenčné spracovanie nemá autorizáciu.' };
  }
  if (!leadBlobRetentionBound(environment)) {
    return { level: 'disabled', label: 'Bezpečne vypnutá', detail: 'Väzba produkčnej databázy a súkromného úložiska nie je overená.' };
  }
  if (!scheduledWorkerReady(environment)) {
    return { level: 'warning', label: 'Čaká na worker', detail: 'Väzba úložiska je overená, ale plánované retenčné spracovanie nemá autorizáciu.' };
  }
  return environment.LEAD_UPLOAD_RETENTION_DELETE_ENABLED === '1'
    ? { level: 'ok', label: 'Aktívna', detail: 'Mazanie exspirovaných nepripojených príloh je explicitne zapnuté.' }
    : { level: 'warning', label: 'Len inventúra', detail: 'Úložisko je overené, automatické mazanie zatiaľ nie je povolené.' };
}

function photoIntakeState(environment: RuntimeEnvironment): RuntimeFeatureState {
  if (privatePhotoIntakeEnabled(environment)) {
    return scheduledWorkerReady(environment)
      ? { level: 'ok', label: 'Pripravený', detail: 'Súkromný príjem tímových fotografií a jeho retencia sú zapnuté.' }
      : { level: 'warning', label: 'Čaká na worker', detail: 'Príjem fotografií je nakonfigurovaný, ale retenčný worker nemá autorizáciu.' };
  }
  if (photoIntakeRetentionRequested(environment) || privatePhotoIntakeStorageReady(environment)) {
    return { level: 'warning', label: 'Neúplná konfigurácia', detail: 'Časť bezpečnostnej väzby existuje, nový príjem fotografií zostáva vypnutý.' };
  }
  return { level: 'disabled', label: 'Vypnutý', detail: 'Tímový príjem fotografií nie je produkčne nakonfigurovaný.' };
}

function operationsAlertState(environment: RuntimeEnvironment): RuntimeFeatureState {
  const configuration = getOpsAlertConfiguration(environment);
  if (configuration.status === 'disabled') {
    return { level: 'disabled', label: 'Vypnuté', detail: 'Externé upozornenia na poruchy doručovania nie sú zapnuté.' };
  }
  if (configuration.status === 'misconfigured') {
    return { level: 'warning', label: 'Neúplná konfigurácia', detail: 'Upozornenia zostávajú bezpečne vypnuté, kým nebude platný webhook a podpisový kľúč.' };
  }
  return scheduledWorkerReady(environment)
    ? { level: 'ok', label: 'Pripravené', detail: 'Poruchy doručovania a následné obnovenie sa hlásia podpísaným webhookom bez osobných údajov.' }
    : { level: 'warning', label: 'Čaká na worker', detail: 'Webhook je pripravený, ale plánované kontroly nemajú autorizáciu.' };
}

export function getRuntimeFeatureHealth(environment: RuntimeEnvironment = process.env) {
  const metaReady = isMetaCapiConfigured(environment);
  const workerReady = scheduledWorkerReady(environment);
  const careerRetentionReady = careerCvRetentionBound(environment);
  const facebookMessenger = getFacebookMessengerConfiguration(environment);
  const gmailPriceOffers = getGmailPriceOfferConfiguration(environment);
  return {
    conversion: metaReady && workerReady
      ? { level: 'ok', label: 'Pripravené', detail: 'Serverové meranie je nakonfigurované; prijatie poskytovateľom sleduje outbox.' }
      : metaReady
        ? { level: 'warning', label: 'Čaká na worker', detail: 'Konverzný transport je pripravený, ale plánované odosielanie nemá autorizáciu.' }
        : { level: 'warning', label: 'Bezpečne vypnuté', detail: 'Neúplná konfigurácia neodosiela serverové konverzie ani nepredstiera úspech.' },
    routeDistance: { level: 'disabled', label: 'Súkromný ručný režim', detail: 'Kilometre sa dopĺňajú ručne. Presné adresy zákazníkov sa neposielajú externej mapovej službe.' },
    leadRetention: leadRetentionState(environment),
    careerRetention: careerRetentionReady && workerReady
      ? { level: 'ok', label: 'Aktívna', detail: 'Retencia súkromných životopisov je viazaná na produkčný store a databázu.' }
      : careerRetentionReady
        ? { level: 'warning', label: 'Čaká na worker', detail: 'Produkčná väzba je overená, ale plánované mazanie nemá autorizáciu.' }
        : { level: 'disabled', label: 'Bezpečne vypnutá', detail: 'Automatické mazanie životopisov nemá úplnú overenú produkčnú väzbu.' },
    photoIntake: photoIntakeState(environment),
    operationsAlert: operationsAlertState(environment),
    facebookMessenger: facebookMessenger.configured
      ? { level: 'ok', label: 'Konfigurácia pripravená', detail: 'Meta aplikácia, podpis webhooku a šifrovanie tokenu sú pripravené. Stav pripojenej stránky je vo Facebook správach.' }
      : { level: 'disabled', label: 'Bezpečne vypnuté', detail: 'Neúplná konfigurácia neprijíma ani neodosiela Facebook správy.' },
    gmailPriceOffers: gmailPriceOffers.configured && workerReady
      ? { level: 'ok', label: 'Konfigurácia pripravená', detail: 'OAuth a plánovaný worker sú pripravené. Stav pripojeného Gmail účtu je v Nastaveniach.' }
      : gmailPriceOffers.configured
        ? { level: 'warning', label: 'Čaká na worker', detail: 'Gmail OAuth je pripravený, ale plánované označovanie nemá autorizáciu.' }
        : { level: 'disabled', label: 'Bezpečne vypnuté', detail: 'Neúplná konfigurácia nemení žiadne správy v Gmaili.' },
  } satisfies Record<string, RuntimeFeatureState>;
}
