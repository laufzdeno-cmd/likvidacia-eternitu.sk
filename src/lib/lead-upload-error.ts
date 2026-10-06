import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobContentTypeNotAllowedError,
  BlobFileTooLargeError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
} from '@vercel/blob';

function isBlobError(error: unknown, errorType: Function): boolean {
  // Node test/runtime loaders can resolve the SDK's ESM and CJS exports as distinct classes.
  return error instanceof errorType || (error instanceof Error && error.constructor.name === errorType.name);
}

export function leadPhotoUploadErrorMessage(error: unknown, fileName: string, timedOut: boolean): string {
  const preserved = 'Údaje aj vybrané fotky zostali vo formulári.';

  if (timedOut) return `Nahrávanie súboru ${fileName} trvalo príliš dlho. ${preserved} Skúste odoslanie znova.`;
  if (isBlobError(error, BlobFileTooLargeError)) return `Úložisko odmietlo veľkosť súboru ${fileName}. Vyberte menšiu fotku. ${preserved}`;
  if (isBlobError(error, BlobContentTypeNotAllowedError)) return `Úložisko neprijalo formát súboru ${fileName}. Vyberte JPG, JPEG, PNG alebo WEBP. Fotku z iPhonu uložte ako JPG. ${preserved}`;
  if (isBlobError(error, BlobServiceRateLimited)) return `Nahrávanie fotiek je dočasne obmedzené. Počkajte pár minút a skúste to znova. ${preserved}`;
  if (isBlobError(error, BlobClientTokenExpiredError)) return `Platnosť nahrávania vypršala. Skúste odoslanie znova. ${preserved}`;
  if ([BlobAccessError, BlobStoreNotFoundError, BlobStoreSuspendedError, BlobServiceNotAvailable].some((errorType) => isBlobError(error, errorType))) {
    return `Nahrávanie fotiek je momentálne nedostupné. ${preserved} Skúste to neskôr alebo zavolajte 0905 217 946.`;
  }
  return `Fotky sa nepodarilo nahrať. ${preserved} Dopyt môžete odoslať bez fotiek po ich odstránení z formulára alebo zavolajte 0905 217 946.`;
}
