/** One approved content-photo context per public page slot. No image or content imports here. */
const assignments = {
  "/": [
    "azbest-087",
    "azbest-164",
    "azbest-057",
    "azbest-110"
  ],
  "/likvidacia-azbestu/": [
    "azbest-111"
  ],
  "/likvidacia-eternitu/": [
    "azbest-018"
  ],
  "/cena-likvidacie-azbestu/": [
    "azbest-150"
  ],
  "/postup/": [
    "azbest-027",
    "azbest-051",
    "azbest-121",
    "azbest-068"
  ],
  "/kde-posobime/": [
    "azbest-065"
  ],
  "/faq/": [
    "azbest-132"
  ],
  "/recenzie/": [
    "azbest-090"
  ],
  "/o-firme/": [
    "azbest-067"
  ],
  "/kontakt/": [
    "azbest-050"
  ],
  "/poradna/": [
    "azbest-118",
    "azbest-033",
    "azbest-054",
    "azbest-079",
    "azbest-081",
    "azbest-028",
    "azbest-048",
    "azbest-060",
    "azbest-080"
  ],
  "/strechari/": [
    "azbest-163"
  ],
  "/kariera/": [
    "azbest-075"
  ],
  "/spolupracujuci-strechari/": [
    "azbest-007"
  ],
  "/likvidacia-azbestu-poprad/": [
    "azbest-084"
  ],
  "/likvidacia-azbestu-kosice/": [
    "azbest-108"
  ],
  "/likvidacia-azbestu-presov/": [
    "azbest-039"
  ],
  "/likvidacia-azbestu-zilina/": [
    "azbest-113"
  ],
  "/likvidacia-azbestu-banska-bystrica/": [
    "azbest-042"
  ],
  "/likvidacia-azbestu-bratislava/": [
    "azbest-155"
  ],
  "/likvidacia-azbestu-nitra/": [
    "azbest-049"
  ],
  "/likvidacia-azbestu-trnava/": [
    "azbest-031"
  ],
  "/likvidacia-azbestu-trencin/": [
    "azbest-069"
  ],
  "/poradna/co-je-eternit-a-kedy-obsahuje-azbest/": [
    "azbest-130"
  ],
  "/poradna/preco-neodstranovat-eternit-svojpomocne/": [
    "azbest-135"
  ],
  "/poradna/kolko-stoji-likvidacia-azbestu/": [
    "azbest-134"
  ],
  "/poradna/ake-doklady-dostanete-po-likvidacii-azbestu/": [
    "azbest-120"
  ],
  "/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/": [
    "azbest-088"
  ],
  "/poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/": [
    "azbest-036"
  ],
  "/poradna/azbest-v-interieri-vs-exterieri/": [
    "azbest-171"
  ],
  "/poradna/odvoz-a-balenie-azbestoveho-odpadu/": [
    "azbest-091"
  ],
  "/realizacie/": [
    "azbest-083",
    "azbest-043",
    "azbest-094",
    "azbest-172",
    "azbest-006",
    "azbest-011",
    "azbest-017",
    "azbest-014",
    "azbest-021",
    "azbest-022",
    "azbest-026",
    "azbest-124",
    "azbest-063",
    "azbest-119",
    "azbest-012",
    "azbest-143",
    "azbest-002",
    "azbest-003",
    "azbest-004",
    "azbest-005",
    "azbest-023",
    "azbest-123",
    "azbest-160",
    "azbest-019",
    "azbest-024",
    "azbest-032",
    "azbest-035",
    "azbest-041",
    "azbest-046",
    "azbest-053",
    "azbest-056",
    "azbest-064",
    "azbest-066",
    "azbest-074"
  ]
} as const satisfies Readonly<Record<string, readonly string[]>>;

for (const ids of Object.values(assignments)) Object.freeze(ids);
export const publicPhotoAssignments = Object.freeze(assignments);
export type PublicPhotoRoute = keyof typeof publicPhotoAssignments;

export function pagePhotoIds(route: string): readonly string[] {
  if (!Object.prototype.hasOwnProperty.call(publicPhotoAssignments, route)) {
    throw new Error(`Missing public photo assignment: ${route}`);
  }
  return publicPhotoAssignments[route as PublicPhotoRoute];
}

export function pagePhotoId(route: string, index = 0): string {
  const ids = pagePhotoIds(route);
  if (!Number.isSafeInteger(index) || index < 0 || index >= ids.length) {
    throw new Error(`Missing public photo slot: ${route}[${index}]`);
  }
  return ids[index];
}

const siteOrigin = 'https://likvidacia-eternitu.sk';
const brandImage = /^\/assets\/astana-logo(?:-dark)?\.(?:png|webp|jpe?g|svg)$/i;
const iconImage = /^\/(?:favicon\.(?:ico|svg|png)|apple-touch-icon\.png|assets\/icons\/[^/]+)$/i;
// The paired source JPEGs are byte-identical, despite their historical IDs.
const originalAliases: Readonly<Record<string, string>> = Object.freeze({
  'azbest-013': 'azbest-014',
  'azbest-025': 'azbest-026',
});

/**
 * A JPEG/WebP/AVIF/hero/Next-image variant is the same photograph.
 * null means a known brand/UI or inline image; unknown photo paths retain their identity.
 */
export function publicPhotoIdentity(src: string): string | null {
  return imageIdentity(src, 0);
}

function imageIdentity(src: string, depth: number): string | null {
  const value = src.trim();
  if (!value || /^(?:data|blob):/i.test(value)) return null;
  if (depth > 4) throw new Error('Public photo URL has too many image transformations.');
  const url = new URL(value, siteOrigin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported public photo URL protocol.');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.replace(/\/+$/, '') === '/_next/image') {
    const source = url.searchParams.get('url');
    if (!source) throw new Error('Next image URL is missing its source.');
    return imageIdentity(source, depth + 1);
  }
  const local = ['likvidacia-eternitu.sk','www.likvidacia-eternitu.sk','localhost','127.0.0.1','[::1]'].includes(url.hostname)
    || url.hostname.startsWith('likvidacia-eternitu-') && url.hostname.endsWith('.vercel.app');
  if (!local) return `${url.origin}${pathname}`;
  if (brandImage.test(pathname) || iconImage.test(pathname)) return null;
  if (pathname === '/og/cena-strecha-realizacia.jpg') return 'azbest-150';
  const original = pathname.match(/^\/assets\/azbest\/(?:[^/]+\/)*azbest-(\d{3})(?:[-.])/i);
  if (original) {
    const id = `azbest-${original[1]}`;
    return originalAliases[id] ?? id;
  }
  return pathname;
}
