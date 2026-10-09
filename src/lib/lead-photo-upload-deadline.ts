export class LeadPhotoUploadDeadlineError extends Error {
  constructor() {
    super('Lead photo upload exceeded its deadline.');
    this.name = 'AbortError';
  }
}

export function withLeadPhotoUploadDeadline<T>(
  upload: Promise<T>,
  abortUpload: () => void,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      abortUpload();
      reject(new LeadPhotoUploadDeadlineError());
    }, timeoutMs);

    upload.then(
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
