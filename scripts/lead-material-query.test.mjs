import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('campaign material aliases resolve to exact values offered by the public lead form', async () => {
  const { leadMaterialFromCampaignParam } = await import('../src/lib/lead-material-query.ts');
  const markup = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const select = markup.match(/<select id="materialType"[\s\S]*?<\/select>/)?.[0] || '';
  const options = new Set([...select.matchAll(/<option(?:\s+value="[^"]*")?>([^<]+)<\/option>/g)].map((match) => match[1]));

  for (const [campaignValue, expectedLabel] of [
    ['vlnity', 'Vlnitý eternit'],
    ['PLOCHA', 'Hladký / štvorcový eternit'],
    ['boleticky', 'Boletické panely'],
  ]) {
    assert.equal(leadMaterialFromCampaignParam(campaignValue), expectedLabel);
    assert.ok(options.has(expectedLabel), `The public form must offer the mapped value: ${expectedLabel}`);
  }
});

test('unknown campaign material never selects a form option', async () => {
  const { leadMaterialFromCampaignParam } = await import('../src/lib/lead-material-query.ts');
  assert.equal(leadMaterialFromCampaignParam('other'), undefined);
  assert.equal(leadMaterialFromCampaignParam(null), undefined);
  assert.equal(leadMaterialFromCampaignParam('constructor'), undefined);
  assert.equal(leadMaterialFromCampaignParam('__proto__'), undefined);
});
