/** Isolated browser click through the lead form without optional photos. */
process.env.ASTANA_HARNESS_NO_PHOTO_UI_ONLY = '1';
await import('./lead-private-blob-browser.integration.mjs');
