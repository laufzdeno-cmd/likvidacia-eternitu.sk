/** Repeatable isolated responsive audit; never connects to production. */
process.env.ASTANA_HARNESS_VISUAL_ONLY = '1';
for (const mode of [
  'ASTANA_HARNESS_INVENTORY_ONLY', 'ASTANA_HARNESS_GALLERY_ONLY', 'ASTANA_HARNESS_CAREER_ONLY',
  'ASTANA_HARNESS_CAREER_DIRECT_ONLY', 'ASTANA_HARNESS_PRICE_QUOTE_ONLY', 'ASTANA_HARNESS_TESTIMONIAL_ONLY',
  'ASTANA_HARNESS_SEO_ONLY', 'ASTANA_HARNESS_CONVERSION_ONLY',
]) delete process.env[mode];
await import('./lead-private-blob-browser.integration.mjs');
