export type PreparedLeadPhotoUpload = {
  ok?: boolean;
  uploaded?: boolean;
  pathname?: string;
  presignedUrl?: string;
  uploadHeaders?: Record<string, string>;
  error?: string;
};

export type LeadPhotoUploadInput = {
  submissionId: string;
  fileId: string;
  extension: string;
  contentType: string;
  sizeBytes: number;
};

type FetchLike = typeof fetch;

async function requestLeadPhotoUpload(
  input: LeadPhotoUploadInput,
  action: 'prepare' | 'confirm',
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<PreparedLeadPhotoUpload & { ok: true; pathname: string }> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('/api/lead-upload/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action, ...input }),
      cache: 'no-store',
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({})) as PreparedLeadPhotoUpload;
    if (!response.ok || !result.ok || !result.pathname) {
      throw new Error(result.error || 'Fotku sa nepodarilo pripraviť na nahratie.');
    }
    return result as PreparedLeadPhotoUpload & { ok: true; pathname: string };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function uploadPrivateLeadPhoto(options: {
  file: Blob;
  input: LeadPhotoUploadInput;
  fetchImpl?: FetchLike;
  prepareTimeoutMs?: number;
  uploadTimeoutMs?: number;
}): Promise<{ pathname: string }> {
  const fetchImpl = options.fetchImpl || fetch;
  const prepareTimeoutMs = options.prepareTimeoutMs ?? 15_000;
  const uploadTimeoutMs = options.uploadTimeoutMs ?? 120_000;
  let prepared = await requestLeadPhotoUpload(options.input, 'prepare', fetchImpl, prepareTimeoutMs);
  const pathname = prepared.pathname;
  if (prepared.uploaded) return { pathname };
  if (!prepared.presignedUrl || !prepared.uploadHeaders) {
    throw new Error('Fotku sa nepodarilo bezpečne pripraviť na nahratie.');
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), uploadTimeoutMs);
  try {
    const response = await fetchImpl(prepared.presignedUrl, {
      method: 'PUT',
      headers: prepared.uploadHeaders,
      body: options.file,
      signal: controller.signal,
    });
    const blob = await response.json().catch(() => ({})) as { pathname?: string };
    if (!response.ok || blob.pathname !== pathname) {
      throw new Error('Fotku sa nepodarilo nahrať. Formulár zostal vyplnený, skúste to znova.');
    }
    prepared = await requestLeadPhotoUpload(options.input, 'confirm', fetchImpl, prepareTimeoutMs);
    if (!prepared.uploaded || prepared.pathname !== pathname) {
      throw new Error('Nahratie fotky sa nepodarilo potvrdiť. Formulár zostal vyplnený, skúste to znova.');
    }
    return { pathname };
  } catch (error) {
    const recovered: PreparedLeadPhotoUpload = await requestLeadPhotoUpload(
      options.input,
      'confirm',
      fetchImpl,
      prepareTimeoutMs,
    ).catch(() => ({}));
    if (recovered.uploaded && recovered.pathname === pathname) return { pathname };
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
