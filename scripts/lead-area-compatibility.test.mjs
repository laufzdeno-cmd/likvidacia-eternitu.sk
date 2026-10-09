import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatLeadArea, formatLeadAreaCompact, isLeadAreaUnknown } from '../src/server/lead-area.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('historický príznak neznámej výmery nikdy nezobrazí technickú nulu', () => {
  const unknown = { areaEstimate: 0, rawData: { areaEstimateStatus: 'lead_area_unknown' } };
  assert.equal(isLeadAreaUnknown(unknown), true);
  assert.equal(formatLeadArea(unknown), 'Neviem približnú výmeru');
  assert.equal(formatLeadAreaCompact(unknown), 'Výmera neznáma');
  assert.equal(formatLeadAreaCompact({ areaEstimate: 120, rawData: {} }), '120 m²');
});

test('emailové a operátorské plochy používajú spoločný formát výmery', () => {
  const mail = read('../src/server/mail.ts');
  const detail = read('../app/admin/(protected)/dopyty/[id]/page.tsx');
  const list = read('../app/admin/(protected)/dopyty/page.tsx');
  const dashboard = read('../app/admin/(protected)/dashboard/page.tsx');
  const roofers = read('../app/admin/(protected)/strechari/page.tsx');
  const legacyQuoteRoute = read('../app/admin/(protected)/dopyty/[id]/cenova-ponuka/page.tsx');
  const offerForm = read('../app/admin/(protected)/ponuky/offer-form.tsx');
  const relay = read('../src/server/astana-local-relay.ts');

  assert.match(mail, /formatLeadAreaCompact\(lead\)/);
  assert.doesNotMatch(mail, /plainText\(lead\.areaEstimate\)/);
  assert.match(detail, /formatLeadArea\(lead\)/);
  assert.match(list, /formatLeadAreaCompact\(lead\)/);
  assert.match(dashboard, /formatLeadAreaCompact\(lead\)/);
  assert.match(roofers, /formatLeadAreaCompact\(lead\)/);
  assert.match(legacyQuoteRoute, /redirect\(`\/admin\/ponuky\/nova\?lead=\$\{encodeURIComponent\(id\)\}`\)/);
  assert.doesNotMatch(legacyQuoteRoute, /createQuoteAction|createQuote|pricePerM2/);
  assert.match(offerForm, /areaIsUnknown \? 'Výmera neznáma'/);
  assert.match(offerForm, /job\.m2 > 0 \? `\$\{job\.m2\} m2` : 'výmera neznáma'/);
  assert.match(offerForm, /Výmera nie je vyplnená/);
  assert.match(relay, /areaEstimateStatus: isLeadAreaUnknown\(lead\) \? leadAreaUnknownCode : ''/);
  assert.match(relay, /areaEstimateDisplay: formatLeadAreaCompact\(lead\)/);
});
