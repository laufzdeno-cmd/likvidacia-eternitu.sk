type LeadPhotoFile = Pick<File, 'name' | 'type' | 'arrayBuffer'>;

const photoFingerprints = new WeakMap<object, Promise<string>>();

export function fingerprintLeadPhoto(file: LeadPhotoFile): Promise<string> {
  const cached = photoFingerprints.get(file);
  if (cached) return cached;

  const fingerprint = file.arrayBuffer().then(async (bytes) => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const contentHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${file.name}\u0000${file.type}\u0000${contentHash}`;
  });
  photoFingerprints.set(file, fingerprint);
  void fingerprint.catch(() => photoFingerprints.delete(file));
  return fingerprint;
}

export async function fingerprintLeadUploadGroup(file: LeadPhotoFile): Promise<string> {
  // Hash the local retry identity once more so filenames never enter the upload draft table.
  const fingerprint = await fingerprintLeadPhoto(file);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createLeadFormSnapshot(payload: FormData, photos: LeadPhotoFile[]): Promise<string> {
  const fields = Array.from(payload.entries())
    .filter(([key]) => !['submissionId', 'photos', 'uploadedPhotos', 'companyWebsite', 'leadAttribution', 'analyticsSessionId'].includes(key))
    .map(([key, value]) => [key, value instanceof File ? `${value.name}:${value.size}:${value.lastModified}:${value.type}` : String(value)] as const);
  const photoFields = await Promise.all(photos.map(async (file) => ['photos', await fingerprintLeadPhoto(file)] as const));
  return JSON.stringify([...fields, ...photoFields].sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)));
}

export function removeLeadPhotoUploadIfCurrent<T>(
  cache: Map<string, { promise: Promise<T> }>,
  fingerprint: string,
  promise: Promise<T>,
): void {
  if (cache.get(fingerprint)?.promise === promise) cache.delete(fingerprint);
}
