const AUDITED_PUBLIC_PATHS = new Set([
  '/',
  '/cena-likvidacie-azbestu/',
  '/realizacie/',
  '/poradna/co-je-eternit-a-kedy-obsahuje-azbest/',
  '/kariera/',
]);

export function safeLighthousePath(value, originValue) {
  if (typeof value !== 'string' || !value) return null;
  const origin = new URL(originValue).origin;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return '[blocked-origin]';
    if (AUDITED_PUBLIC_PATHS.has(url.pathname)) return url.pathname;
    if (url.pathname === '/_next/image') return '/_next/image';
    if (url.pathname.startsWith('/_next/static/')) return '/_next/static/[asset]';
    if (url.pathname.startsWith('/assets/')) return '/assets/[asset]';
    if (url.pathname.startsWith('/fonts/')) return '/fonts/[asset]';
    return '[local-resource]';
  } catch {
    return null;
  }
}

export function summarizeLighthouseAudit(audit, originValue) {
  const origin = new URL(originValue).origin;
  const items = Array.isArray(audit?.details?.items) ? audit.details.items : [];
  return {
    score: Number.isFinite(audit?.score) ? audit.score : null,
    numericValue: Number.isFinite(audit?.numericValue) ? Math.round(audit.numericValue) : null,
    overallSavingsMs: Number.isFinite(audit?.details?.overallSavingsMs)
      ? Math.round(audit.details.overallSavingsMs)
      : null,
    itemCount: items.length,
    items: items.slice(0, 8).map((item) => ({
      urlPath: safeLighthousePath(item?.url, origin),
      wastedBytes: Number.isFinite(item?.wastedBytes) ? Math.round(item.wastedBytes) : null,
      totalBytes: Number.isFinite(item?.totalBytes) ? Math.round(item.totalBytes) : null,
      wastedPercent: Number.isFinite(item?.wastedPercent) ? Number(item.wastedPercent.toFixed(1)) : null,
      durationMs: Number.isFinite(item?.duration) ? Math.round(item.duration) : null,
    })),
  };
}

export function summarizeLighthouseLcpBreakdown(items) {
  const rows = (Array.isArray(items) ? items : [])
    .flatMap((item) => item?.type === 'table' && Array.isArray(item.items) ? item.items : [item]);
  const safePhase = (label) => {
    const value = typeof label === 'string' ? label.toLowerCase() : '';
    if (/first byte|server response|ttfb/.test(value)) return 'server-response';
    if (/resource/.test(value) && /delay|discover/.test(value)) return 'resource-delay';
    if (/resource/.test(value) && /duration|load/.test(value)) return 'resource-load';
    if (/element/.test(value) && /render/.test(value)) return 'element-render';
    return 'other';
  };
  return rows
    .filter((item) => Number.isFinite(item?.duration))
    .slice(0, 8)
    .map((item) => ({ phase: safePhase(item.label), durationMs: Math.round(item.duration) }));
}

export function summarizeLighthouseNode(node) {
  const snippet = typeof node?.snippet === 'string' ? node.snippet : '';
  const tagMatch = snippet.match(/^\s*<([a-zA-Z][a-zA-Z0-9-]*)\b/);
  const rect = node?.boundingRect && typeof node.boundingRect === 'object' ? node.boundingRect : null;
  return {
    tag: tagMatch ? tagMatch[1].toLowerCase() : null,
    width: Number.isFinite(rect?.width) ? Math.round(rect.width) : null,
    height: Number.isFinite(rect?.height) ? Math.round(rect.height) : null,
  };
}
