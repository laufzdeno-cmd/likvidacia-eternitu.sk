import { careerCvRetentionBound } from './career-cv-retention-binding';
import { leadBlobRetentionBound } from './lead-blob-retention-binding';
import { isMetaCapiConfigured } from './meta-capi-config';
import {
  photoIntakeRetentionRequested,
  privatePhotoIntakeEnabled,
  privatePhotoIntakeStorageReady,
} from './photo-intake-config';

type RuntimeEnvironment = Record<string, string | undefined>;

export type RuntimeFeatureState = {
  level: 'ok' | 'warning' | 'disabled';
  label: string;
  detail: string;
};

function leadRetentionState(environment: RuntimeEnvironment): RuntimeFeatureState {
  const s3Ready = Boolean(environment.S3_BUCKET && environment.S3_ACCESS_KEY_ID && environment.S3_SECRET_ACCESS_KEY);
  if (!environment.BLOB_READ_WRITE_TOKEN) {
    return s3Ready
      ? { level: 'ok', label: 'Aktívna', detail: 'Súkromné prílohy majú zapnuté retenčné spracovanie.' }
      : { level: 'disabled', label: 'Nenastavená', detail: 'Chýba nakonfigurované súkromné úložisko príloh.' };
  }
  if (!leadBlobRetentionBound(environment)) {
    return { level: 'disabled', label: 'Bezpečne vypnutá', detail: 'Väzba produkčnej databázy a súkromného úložiska nie je overená.' };
  }
  return environment.LEAD_UPLOAD_RETENTION_DELETE_ENABLED === '1'
    ? { level: 'ok', label: 'Aktívna', detail: 'Mazanie exspirovaných nepripojených príloh je explicitne zapnuté.' }
    : { level: 'warning', label: 'Len inventúra', detail: 'Úložisko je overené, automatické mazanie zatiaľ nie je povolené.' };
}

function photoIntakeState(environment: RuntimeEnvironment): RuntimeFeatureState {
  if (privatePhotoIntakeEnabled(environment)) {
    return { level: 'ok', label: 'Pripravený', detail: 'Súkromný príjem tímových fotografií a jeho retencia sú zapnuté.' };
  }
  if (photoIntakeRetentionRequested(environment) || privatePhotoIntakeStorageReady(environment)) {
    return { level: 'warning', label: 'Neúplná konfigurácia', detail: 'Časť bezpečnostnej väzby existuje, nový príjem fotografií zostáva vypnutý.' };
  }
  return { level: 'disabled', label: 'Vypnutý', detail: 'Tímový príjem fotografií nie je produkčne nakonfigurovaný.' };
}

export function getRuntimeFeatureHealth(environment: RuntimeEnvironment = process.env) {
  const metaReady = isMetaCapiConfigured(environment);
  const mapsReady = Boolean(environment.GOOGLE_MAPS_API_KEY?.trim());
  const careerRetentionReady = careerCvRetentionBound(environment);
  return {
    conversion: metaReady
      ? { level: 'ok', label: 'Pripravené', detail: 'Serverové meranie je nakonfigurované; prijatie poskytovateľom sleduje outbox.' }
      : { level: 'warning', label: 'Bezpečne vypnuté', detail: 'Neúplná konfigurácia neodosiela serverové konverzie ani nepredstiera úspech.' },
    routeDistance: mapsReady
      ? { level: 'ok', label: 'Pripravené', detail: 'Automatický návrh kilometrov je nakonfigurovaný; hodnotu možno ďalej upraviť.' }
      : { level: 'warning', label: 'Ručný režim', detail: 'Automatický výpočet kilometrov nie je nastavený; kilometre zostávajú editovateľné ručne.' },
    leadRetention: leadRetentionState(environment),
    careerRetention: careerRetentionReady
      ? { level: 'ok', label: 'Aktívna', detail: 'Retencia súkromných životopisov je viazaná na produkčný store a databázu.' }
      : { level: 'disabled', label: 'Bezpečne vypnutá', detail: 'Automatické mazanie životopisov nemá úplnú overenú produkčnú väzbu.' },
    photoIntake: photoIntakeState(environment),
  } satisfies Record<string, RuntimeFeatureState>;
}
