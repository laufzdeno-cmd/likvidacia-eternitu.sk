import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const homepage = read('../app/page.tsx');
const homepageClient = read('../app/homepage-critical-client.tsx');
const roofersPage = read('../app/strechari/page.tsx');
const publicPartnersPage = read('../app/spolupracujuci-strechari/page.tsx');

test('ETERNIT ROOFER ECOSYSTEM V4 keeps the compact homepage coordination path', () => {
  assert.match(homepage, /Potrebujete po eternite aj novú strechu\?/);
  assert.match(homepage, />Mám strechára</);
  assert.match(homepage, />Nemám strechára</);
  assert.match(homepage, /Chcem pomôcť so strechárom/);
  assert.match(homepage, /id="roofer-recommendation-field" hidden/);
  assert.match(homepage, /Chcem, aby mi ASTANA pomohla nájsť strechára v mojom regióne\./);
  assert.doesNotMatch(homepage, /name="wantsRooferRecommendation"/);
  assert.match(homepage, /action="\/api\/dopyt\/" method="post" encType="multipart\/form-data"/);
});

test('conditional roofer help reuses the already-supported roofer value without changing the endpoint', () => {
  assert.match(homepageClient, /rooferSelect\?\.value === 'Nemám strechára' && rooferRecommendationInput\?\.checked/);
  assert.match(homepageClient, /payload\.set\('roofer', 'Chcem odporučiť strechára podľa regiónu'\)/);
  assert.match(homepageClient, /rooferSelect\?\.addEventListener\('change', syncRooferRecommendationControl\)/);
  assert.doesNotMatch(homepageClient, /fetch\('.*roofer/i);
});

test('partner page separates ASTANA from roofing work and gates partner materials behind verification', () => {
  assert.match(roofersPage, /Vy robíte strechu\. My vyriešime azbest\./);
  assert.match(roofersPage, /Každý rieši svoju časť\. ASTANA azbest a doklady, strechár novú strechu\./);
  assert.doesNotMatch(roofersPage, /My sa nemusíme hrať na strechárov/);
  assert.match(roofersPage, /Podklady pre schválených partnerov/);
  assert.match(roofersPage, /Texty a grafické podklady poskytujeme individuálne až po overení spolupráce/);
  assert.match(roofersPage, /Samotná registrácia[\s\S]*neoprávňuje firmu používať označenie partnera ani logo ASTANA/);
  assert.doesNotMatch(roofersPage, /\/downloads\/strechari/);
  assert.doesNotMatch(roofersPage, /Spolupracujeme s ASTANA/);
  assert.doesNotMatch(roofersPage, /certifikovaný|certifikačný|oficiálny partner/i);
});

test('public partner page remains an information page, not an unconsented directory', () => {
  assert.match(publicPartnersPage, /Verejné profily až so súhlasom/);
  assert.doesNotMatch(publicPartnersPage, /listRoofers|listReferralEligibleRoofers|customerReferralEvidence/);
});
