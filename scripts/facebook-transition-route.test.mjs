import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'tsx/esm/api';

register();
const { GET, HEAD } = await import('../app/facebook-cenova-ponuka/route.ts');

const allowedParameters = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'gclid', 'fbclid', 'gbraid', 'wbraid',
];

test('Facebook transition preserves only the current bounded attribution fields', () => {
  const query = new URLSearchParams({
    utm_source: 'facebook',
    utm_medium: 'paid_social',
    utm_campaign: 'Azbest – celé Slovensko',
    utm_content: 'video-1',
    utm_term: 'likvidacia azbestu',
    utm_id: 'meta-2026',
    gclid: 'google-click',
    fbclid: 'meta-click',
    gbraid: 'google-braid',
    wbraid: 'web-braid',
    utm_email: 'person@example.com',
    email: 'person@example.com',
    redirect: 'https://outside.example/steal',
    next: '//outside.example/steal',
  });

  const response = GET(new Request(`https://likvidacia-eternitu.sk/facebook-cenova-ponuka/?${query}`));
  assert.equal(response.status, 307);

  const location = response.headers.get('location');
  assert.ok(location?.startsWith('/?'), 'redirect stays relative to the current origin');
  const target = new URL(location, 'https://likvidacia-eternitu.sk');
  assert.equal(target.origin, 'https://likvidacia-eternitu.sk');
  assert.equal(target.pathname, '/');
  assert.equal(target.hash, '#dopyt');
  assert.deepEqual([...target.searchParams.keys()], allowedParameters);
  assert.equal(target.searchParams.get('utm_campaign'), 'Azbest – celé Slovensko');
  assert.equal(target.searchParams.get('utm_email'), null);
  assert.equal(target.searchParams.get('email'), null);
  assert.equal(target.searchParams.get('redirect'), null);
  assert.equal(target.searchParams.get('next'), null);
});

test('Facebook transition rejects unsafe, oversized, empty and duplicate fallback values', () => {
  const query = new URLSearchParams();
  query.append('utm_source', 'facebook');
  query.append('utm_source', 'attacker-second-value');
  query.set('utm_campaign', 'x'.repeat(161));
  query.set('utm_content', 'line\nbreak');
  query.set('utm_term', '   ');
  query.set('fbclid', 'f'.repeat(513));
  query.set('gclid', 'safe-click');

  const response = GET(new Request(`https://host-header.example/facebook-cenova-ponuka/?${query}`));
  const location = response.headers.get('location');
  assert.ok(location);
  const target = new URL(location, 'https://likvidacia-eternitu.sk');

  assert.equal(target.searchParams.get('utm_source'), 'facebook');
  assert.equal(target.searchParams.getAll('utm_source').length, 1);
  assert.equal(target.searchParams.get('gclid'), 'safe-click');
  assert.equal(target.searchParams.get('utm_campaign'), null);
  assert.equal(target.searchParams.get('utm_content'), null);
  assert.equal(target.searchParams.get('utm_term'), null);
  assert.equal(target.searchParams.get('fbclid'), null);
  assert.equal(response.headers.get('location')?.startsWith('/'), true, 'request host cannot control the redirect origin');
});

test('GET and HEAD use a non-cacheable, non-indexable relative form redirect', () => {
  for (const handler of [GET, HEAD]) {
    const response = handler(new Request('https://likvidacia-eternitu.sk/facebook-cenova-ponuka/'));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), '/#dopyt');
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  }
});
