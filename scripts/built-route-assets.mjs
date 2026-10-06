export function extractStylesheetHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => {
      const rel = tag.match(/\brel=(["'])(.*?)\1/i)?.[2] || '';
      return rel.split(/\s+/).some((value) => value.toLowerCase() === 'stylesheet');
    })
    .map((tag) => tag.match(/\bhref=(["'])(.*?)\1/i)?.[2] || '')
    .filter(Boolean);
}
