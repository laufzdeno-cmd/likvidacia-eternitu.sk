function hasErrorName(error: unknown, expectedNames: readonly string[]): boolean {
  return error instanceof Error && expectedNames.includes(error.constructor.name);
}

export function leadPhotoUploadErrorMessage(error: unknown, fileName: string, timedOut: boolean): string {
  const preserved = 'Údaje aj vybrané fotky zostali vo formulári.';

  if (timedOut) return `Nahrávanie súboru ${fileName} trvalo príliš dlho. ${preserved} Skúste odoslanie znova.`;
  if (hasErrorName(error, ['BlobFileTooLargeError'])) return `Úložisko odmietlo veľkosť súboru ${fileName}. Vyberte menšiu fotku. ${preserved}`;
  if (hasErrorName(error, ['BlobContentTypeNotAllowedError'])) return `Úložisko neprijalo formát súboru ${fileName}. Vyberte JPG, JPEG, PNG alebo WEBP. Fotku z iPhonu uložte ako JPG. ${preserved}`;
  if (hasErrorName(error, ['BlobServiceRateLimited'])) return `Nahrávanie fotiek je dočasne obmedzené. Počkajte pár minút a skúste to znova. ${preserved}`;
  if (hasErrorName(error, ['BlobClientTokenExpiredError'])) return `Platnosť nahrávania vypršala. Skúste odoslanie znova. ${preserved}`;
  if (hasErrorName(error, ['BlobAccessError', 'BlobStoreNotFoundError', 'BlobStoreSuspendedError', 'BlobServiceNotAvailable'])) {
    return `Nahrávanie fotiek je momentálne nedostupné. ${preserved} Skúste to neskôr alebo zavolajte 0905 217 946.`;
  }
  return `Fotky sa nepodarilo nahrať. ${preserved} Dopyt môžete odoslať bez fotiek po ich odstránení z formulára alebo zavolajte 0905 217 946.`;
}
