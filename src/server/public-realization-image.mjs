import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Public realization images must be served from this site. Apart from making
 * the public page predictable, this prevents embedding arbitrary remote URLs
 * that could disclose a visitor's IP address to a third party.
 */
export function normalizePublicRealizationImageUrl(value) {
  const input = value.trim();
  let url = input;
  if (!input.startsWith('/')) {
    try {
      const parsed = new URL(input);
      if (
        parsed.protocol !== 'https:' ||
        !['likvidacia-eternitu.sk', 'www.likvidacia-eternitu.sk'].includes(parsed.hostname) ||
        parsed.port || parsed.username || parsed.password
      ) {
        return null;
      }
      url = parsed.pathname;
    } catch {
      return null;
    }
  }

  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\') || /[\u0000-\u001f\u007f]/.test(url)) return null;
  const pathname = url.split(/[?#]/, 1)[0];
  // Reject percent encoding entirely so downstream URL parsers cannot decode a
  // traversal or separator a second time after this value has been stored.
  if (pathname.includes('%')) return null;
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (
    !decodedPathname.startsWith('/assets/') ||
    decodedPathname.includes('\\') ||
    decodedPathname.split('/').length !== pathname.split('/').length ||
    decodedPathname.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    return null;
  }

  if (!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(decodedPathname)) return null;
  return decodedPathname;
}

export function isSafePublicRealizationImageUrl(value) {
  return normalizePublicRealizationImageUrl(value) !== null;
}

const productionHosts = new Set(['likvidacia-eternitu.sk', 'www.likvidacia-eternitu.sk']);
const imageContentType = /^image\/(?:avif|gif|jpeg|png|webp)(?:\s*;|$)/i;

/** Verify the public asset on the same production alias that served the admin action. */
export async function checkPublicRealizationImagesAvailable(imageUrls, options = {}) {
  const urls = imageUrls.map(normalizePublicRealizationImageUrl);
  if (urls.some((url) => url === null)) return { available: false, reason: 'image-unavailable' };

  const publicRoot = options.publicRoot ?? path.join(process.cwd(), 'public');
  const isVercel = options.isVercel ?? process.env.VERCEL === '1';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const requestHost = options.requestHost?.toLowerCase() ?? '';
  if (isVercel && (
    (options.vercelEnv ?? process.env.VERCEL_ENV) !== 'production'
    || (options.vercelTargetEnv ?? process.env.VERCEL_TARGET_ENV) !== 'production'
    || !productionHosts.has(requestHost)
  )) {
    return { available: false, reason: 'verification-unavailable' };
  }
  if (urls.length === 0) return { available: true };

  const available = await Promise.all(urls.map(async (url) => {
    if (!isVercel) {
      try {
        const file = await stat(path.join(publicRoot, url.slice(1)));
        return file.isFile() && file.size > 0;
      } catch {
        return false;
      }
    }

    try {
      const response = await fetchImpl(`https://${requestHost}${url}`, {
        method: 'HEAD',
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      const length = response.headers.get('content-length');
      return response.status === 200
        && imageContentType.test(response.headers.get('content-type') ?? '')
        && (length === null || (/^\d+$/.test(length) && Number(length) > 0));
    } catch {
      return false;
    }
  }));
  return available.every(Boolean)
    ? { available: true }
    : { available: false, reason: 'image-unavailable' };
}

export async function arePublicRealizationImagesAvailable(imageUrls, options = {}) {
  return (await checkPublicRealizationImagesAvailable(imageUrls, options)).available;
}
