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

test('partner page separates ASTANA from roofing work and includes the requested voluntary partner kit', () => {
  assert.match(roofersPage, /Vy robíte strechu\. My vyriešime azbest\./);
  assert.match(roofersPage, /Každý rieši svoju časť\. ASTANA azbest a doklady, strechár novú strechu\./);
  assert.doesNotMatch(roofersPage, /My sa nemusíme hrať na strechárov/);
  assert.match(roofersPage, /SPOLUPRACUJETE S ASTANA\? MÔŽETE TO UVIESŤ AJ NA SVOJOM WEBE\./);
  assert.match(roofersPage, /Pri zákazkách so starým eternitom spolupracujeme so spoločnosťou ASTANA, s\.r\.o\./);
  assert.match(roofersPage, /Likvidáciu eternitu pri našich zákazkách riešime v spolupráci s ASTANA, s\.r\.o\./);
  assert.match(roofersPage, /\/downloads\/strechari\/astana-partner-badge\.svg/);
  assert.match(roofersPage, /SPOLUPRACUJEME S ASTANA/);
  assert.match(roofersPage, /Nejde o certifikát, členstvo ani podmienku spolupráce/);
  assert.doesNotMatch(roofersPage, /certifikovaný|certifikačný|oficiálny partner/i);
});

test('public partner page remains an information page, not an unconsented directory', () => {
  assert.match(publicPartnersPage, /Verejné profily až so súhlasom/);
  assert.doesNotMatch(publicPartnersPage, /listRoofers|listReferralEligibleRoofers|customerReferralEvidence/);
});
