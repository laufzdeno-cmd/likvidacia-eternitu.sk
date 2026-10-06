export async function addUniqueLeadPhotos<T>(
  current: T[],
  incoming: T[],
  fingerprint: (file: T) => Promise<string>,
  maxFiles = 10,
): Promise<{ files: T[]; duplicateFiles: T[]; overflowFiles: T[] }> {
  const fingerprints = new Set(await Promise.all(current.map(fingerprint)));
  const files = [...current];
  const duplicateFiles: T[] = [];
  const overflowFiles: T[] = [];

  for (const file of incoming) {
    const hash = await fingerprint(file);
    if (fingerprints.has(hash)) {
      duplicateFiles.push(file);
      continue;
    }
    if (files.length >= maxFiles) {
      overflowFiles.push(file);
      continue;
    }
    fingerprints.add(hash);
    files.push(file);
  }

  return { files, duplicateFiles, overflowFiles };
}

export function resetMissingLeadPhotoUpload<T extends { pathname: string; promise?: unknown }>(
  uploads: Map<string, T>,
  missingPathname: string,
) {
  for (const upload of uploads.values()) {
    if (upload.pathname !== missingPathname) continue;
    upload.promise = undefined;
    return true;
  }
  return false;
}
