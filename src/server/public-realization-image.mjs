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
