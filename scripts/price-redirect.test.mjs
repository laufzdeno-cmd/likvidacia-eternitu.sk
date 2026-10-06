import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('legacy price alias preserves one bounded value for each approved campaign parameter', async () => {
  const { priceRedirectTarget } = await import('../src/server/price-redirect.ts');
  assert.equal(
    priceRedirectTarget({
      utm_source: 'google',
      utm_campaign: 'strecha jar',
      utm_content: ['roof', 'ignored-duplicate'],
      gclid: 'click-123',
      fbclid: 'social-456',
      tag: ['a', 'b'],
      email: 'private@example.com',
    }),
    '/cena-likvidacie-azbestu/?utm_source=google&utm_campaign=strecha+jar&utm_content=roof&gclid=click-123&fbclid=social-456',
  );
});

test('legacy price alias preserves bounded UTM IDs, quote prefill and supported click IDs', async () => {
  const { priceRedirectTarget } = await import('../src/server/price-redirect.ts');
  assert.equal(
    priceRedirectTarget({ UTM_SOURCE: 'newsletter', gbraid: 'g-1', wbraid: 'w-1', msclkid: 'm-1', utm_id: 'campaign-9', material: 'boleticky', plocha: '240', m2: '240', city: 'Poprad', cta: 'quote', secret: 'drop-me' }),
    '/cena-likvidacie-azbestu/?utm_source=newsletter&gbraid=g-1&wbraid=w-1&msclkid=m-1&utm_id=campaign-9&material=boleticky&plocha=240&m2=240&city=Poprad&cta=quote',
  );
});

test('legacy price alias bounds query values before redirecting', async () => {
  const { priceRedirectTarget } = await import('../src/server/price-redirect.ts');
  assert.equal(priceRedirectTarget({ utm_campaign: 'x'.repeat(250) }).split('=')[1].length, 200);
  assert.equal(priceRedirectTarget({ gclid: 'x'.repeat(600) }).split('=')[1].length, 512);
});

test('legacy price alias keeps the first value when parameter names differ only by case', async () => {
  const { priceRedirectTarget } = await import('../src/server/price-redirect.ts');
  assert.equal(
    priceRedirectTarget({ UTM_SOURCE: 'first', utm_source: 'second', GCLID: 'click-first', gclid: ['click-second', 'click-third'] }),
    '/cena-likvidacie-azbestu/?utm_source=first&gclid=click-first',
  );
});

test('legacy price alias keeps the canonical target clean when no query is present', async () => {
  const { priceRedirectTarget } = await import('../src/server/price-redirect.ts');
  assert.equal(priceRedirectTarget({}), '/cena-likvidacie-azbestu/');
  assert.equal(priceRedirectTarget({ ignored: undefined }), '/cena-likvidacie-azbestu/');
});

test('legacy route passes the complete Next.js query object to the tested redirect helper', async () => {
  const route = await readFile(new URL('../app/cena/page.tsx', import.meta.url), 'utf8');
  assert.match(route, /searchParams:\s*Promise<Record<string, string \| string\[\] \| undefined>>/);
  assert.match(route, /permanentRedirect\(priceRedirectTarget\(await searchParams\)\)/);
});
