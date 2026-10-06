import assert from 'node:assert/strict';
import test from 'node:test';
import attributionModule from '../src/server/lead-attribution.ts';
import touchModule from '../src/lib/attribution-touch.ts';

const { parseLeadAttribution } = attributionModule;
const { carryConsentedCampaignParameters, selectCampaignTouch } = touchModule;

test('a new campaign replaces the complete prior touch instead of mixing campaign fields', () => {
  const google = { utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'search', gclid: 'g-1', landingPath: '/cena/' };
  const instagram = { utmSource: 'instagram', utmMedium: 'paid_social', utmCampaign: 'social', utmContent: 'roof-video', fbclid: 'f-2', landingPath: '/' };
  assert.deepEqual(selectCampaignTouch(google, instagram), instagram);
  assert.deepEqual(selectCampaignTouch(google, {}), google, 'priama návšteva nemá vymazať zachytenú kampaň');
});

test('same-site form navigation carries only consented bounded campaign parameters', () => {
  const source = new URL('https://likvidacia-eternitu.sk/cena-likvidacie-azbestu/?utm_source=google&utm_campaign=Azbest%20%E2%80%93%20Slovensko&gclid=click-123');
  const target = new URL('https://likvidacia-eternitu.sk/#dopyt');
  assert.equal(carryConsentedCampaignParameters(source, target, { analytics: true, marketing: false }), true);
  assert.equal(target.searchParams.get('utm_campaign'), 'Azbest – Slovensko');
  assert.equal(target.searchParams.get('gclid'), null, 'click IDs are not carried without marketing consent');
  assert.equal(target.searchParams.get('astana_landing'), '/cena-likvidacie-azbestu/');

  const noAnalyticsTarget = new URL('https://likvidacia-eternitu.sk/#dopyt');
  assert.equal(carryConsentedCampaignParameters(source, noAnalyticsTarget, { analytics: false, marketing: true }), false);
  assert.equal(noAnalyticsTarget.search, '');
  const crossOriginTarget = new URL('https://example.org/#dopyt');
  assert.equal(carryConsentedCampaignParameters(source, crossOriginTarget, { analytics: true, marketing: true }), false);
  assert.equal(crossOriginTarget.search, '');
});

test('analytics consent stores campaign attribution without marketing consent', () => {
  assert.deepEqual(parseLeadAttribution(JSON.stringify({
    utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'strecha Poprad 2026', landingPath: '/cena/',
    utmContent: 'strecha-video', utmTerm: 'likvidacia-eternitu', utmId: 'campaign-9',
    gclid: 'click-123', fbclid: 'meta-123', gbraid: 'google-braid', wbraid: 'web-braid',
  }), { analytics: true, marketing: false }), {
    utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'strecha Poprad 2026',
    utmContent: 'strecha-video', utmTerm: 'likvidacia-eternitu', utmId: 'campaign-9', landingPath: '/cena/',
  });
});

test('one invalid campaign field does not discard valid source, campaign ID or consented click ID', () => {
  assert.deepEqual(parseLeadAttribution(JSON.stringify({
    utmSource: 'google', utmCampaign: 'Search | Azbest', utmId: '123', utmTerm: '<script>', gclid: 'abc',
  }), { analytics: true, marketing: true }), {
    utmSource: 'google', utmCampaign: 'Search | Azbest', utmId: '123', gclid: 'abc',
  });
});

test('campaign names retain the punctuation used by real Google and Meta campaigns', () => {
  const value = JSON.stringify({
    utmSource: 'google',
    utmCampaign: 'Azbest – bezpečne a legálne (SK) & ASTANA',
    utmContent: 'strecha – Poprad',
  });
  assert.deepEqual(parseLeadAttribution(value, { analytics: true, marketing: false }), {
    utmSource: 'google',
    utmCampaign: 'Azbest – bezpečne a legálne (SK) & ASTANA',
    utmContent: 'strecha – Poprad',
  });
});

test('click identifiers are stored only with both analytics and marketing consent', () => {
  const value = JSON.stringify({ utmSource: 'facebook', gclid: 'google-123', fbclid: 'meta-123', gbraid: 'google-braid', wbraid: 'web-braid' });
  assert.deepEqual(parseLeadAttribution(value, { analytics: true, marketing: true }), {
    utmSource: 'facebook', gclid: 'google-123', fbclid: 'meta-123', gbraid: 'google-braid', wbraid: 'web-braid',
  });
  assert.deepEqual(parseLeadAttribution(value, { analytics: true, marketing: false }), { utmSource: 'facebook' });
  assert.equal(parseLeadAttribution(value, { analytics: false, marketing: true }), undefined);
  assert.equal(parseLeadAttribution(value, { analytics: false, marketing: false }), undefined);
});

test('malformed, oversized, unexpected, and unsafe attribution is ignored', () => {
  assert.equal(parseLeadAttribution('{', { analytics: true, marketing: true }), undefined);
  assert.equal(parseLeadAttribution('x'.repeat(8193), { analytics: true, marketing: true }), undefined);
  assert.equal(parseLeadAttribution(JSON.stringify({ utmSource: 'google', email: 'person@example.com' }), { analytics: true, marketing: true }), undefined);
  assert.equal(parseLeadAttribution(JSON.stringify({ utmSource: 'google\nads' }), { analytics: true, marketing: true }), undefined);
  assert.equal(parseLeadAttribution(JSON.stringify({ utmSource: 'google\n' }), { analytics: true, marketing: true }), undefined);
  assert.equal(parseLeadAttribution(JSON.stringify({ landingPath: '//outside.example' }), { analytics: true, marketing: true }), undefined);
  assert.equal(parseLeadAttribution(JSON.stringify({ gclid: '<script>' }), { analytics: true, marketing: true }), undefined);
});

test('valid multi-parameter attribution over 2 KiB is preserved within the request cap', () => {
  const value = JSON.stringify({
    utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'A'.repeat(150), utmContent: 'B'.repeat(150),
    utmTerm: 'C'.repeat(150), utmId: 'D'.repeat(150), landingPath: `/${'e'.repeat(280)}`,
    gclid: 'g'.repeat(512), fbclid: 'f'.repeat(512), gbraid: 'b'.repeat(512), wbraid: 'w'.repeat(512),
  });
  assert.ok(value.length > 2048 && value.length < 8192);
  const parsed = parseLeadAttribution(value, { analytics: true, marketing: true });
  assert.equal(parsed?.utmCampaign, 'A'.repeat(150));
  assert.equal(parsed?.wbraid, 'w'.repeat(512));
});
