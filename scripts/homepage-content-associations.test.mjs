import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterHomepageTrustItems, normalizeHomepageCoverageText } from '../src/lib/homepage-trust-items.mjs';
import { transportPolicy } from '../src/content/transport-policy.mjs';

const homepage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const defaults = readFileSync(new URL('../src/server/site-content.ts', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../app/admin/(protected)/obsah/page.tsx', import.meta.url), 'utf8');
const seo = readFileSync(new URL('../app/seo-components.tsx', import.meta.url), 'utf8');
const company = JSON.parse(readFileSync(new URL('../public/data/company.json', import.meta.url), 'utf8'));
const llms = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');
const pricePage = readFileSync(new URL('../app/cena-likvidacie-azbestu/page.tsx', import.meta.url), 'utf8');
const photoReferences = readFileSync(new URL('../src/data/azbestReferences.ts', import.meta.url), 'utf8');

test('consolidated homepage trust keeps editable titles paired with their descriptions', () => {
  assert.match(homepage, /trustItems\.map\(\(\[title, text\], index\)/);
  assert.match(homepage, /className="trust-item" key=\{title\}[\s\S]*?<strong>\{title\}<\/strong>\s*<p>\{text\}<\/p>/);
  assert.match(homepage, /id="preco" aria-labelledby="why-title"/);
  assert.match(homepage, /id="why-title"[^>]*>\{content\.whyTitle\}<\/h2>/);
  assert.doesNotMatch(homepage, /className="why-card-grid"/);
  assert.doesNotMatch(homepage, /whyItems\[index\]/);
});

test('homepage hero claim and supporting text have distinct jobs', () => {
  assert.doesNotMatch(homepage, /heroClaim:\s*['`]/);
  assert.doesNotMatch(homepage, /heroText:\s*['`]/);
  assert.match(defaults, /heroClaim: 'Pošlite nám približnú výmeru a obec\. O ďalší postup sa postaráme my\.'/);
  assert.match(defaults, /heroText:\s*`Zabezpečíme potrebné podklady, bezpečnú demontáž, balenie a odvoz\. Výsledkom je \$\{serviceDocumentationOutcome\}\.\`/);
});

test('homepage evidence describes the three representative photos accurately', () => {
  assert.match(defaults, /tri ukážky prác na rodinnom dome, hospodárskej budove a priemyselnom objekte/);
  assert.match(homepage, /\{content\.realizationsText\}/);
  assert.doesNotMatch(homepage, /šesť ukážok|tri ukážky[^.]*interiéri/);
  assert.match(homepage, /\['azbest-164', 'azbest-120', 'azbest-110'\]\.includes\(item\.image\.id\)/);
  assert.match(homepage, /homepageHighlights\.map\(\(item\)/);
  assert.match(homepage, /href="\/realizacie\/">Zobraziť všetky realizácie<\/a>/);
  assert.match(defaults, /whyExperienceText: 'Firma ASTANA pôsobí na trhu od roku 2011\.'/);
});

test('homepage ponúka pravdivé obchodné dôkazy bez vymysleného hodnotenia', () => {
  assert.match(homepage, /href="\/realizacie\/">Ukážky reálnych striech ASTANA\.<\/a>/);
  assert.match(homepage, /href="\/recenzie\/">Prečítajte si, ako overujeme referencie zákazníkov\.<\/a>/);
  assert.doesNotMatch(homepage, /Prečítajte si overené referencie zákazníkov/);
  assert.doesNotMatch(homepage, /\b[45][.,]\d\s*\/\s*5\b|\b\d+\s+spokojných zákazníkov\b/i);
});

test('2011 refers only to company activity, including the legacy trust-bar row', () => {
  assert.doesNotMatch(homepage, /Skúsenosti s azbestom a eternitom/);
  assert.doesNotMatch(defaults, /Skúsenosti s azbestom a eternitom/);
  assert.match(defaults, /Firma ASTANA pôsobí od roku 2011\|Pôsobíme na trhu od roku 2011\./);
  assert.deepEqual(filterHomepageTrustItems([[' Od roku 2011 ', 'Skúsenosti s azbestom od roku 2011.']]), [
    ['Firma ASTANA pôsobí od roku 2011', 'Pôsobíme na trhu od roku 2011.'],
  ]);
});

test('approved transport rule is shared by public, machine-readable and price surfaces', () => {
  assert.equal(company.transport_policy, transportPolicy.full);
  assert.ok(llms.includes(transportPolicy.full));
  assert.match(homepage, /import \{ transportPolicy \} from '@\/src\/content\/transport-policy\.mjs'/);
  assert.match(defaults, /\$\{transportPolicy\.title\}\|\$\{transportPolicy\.full\}/);
  assert.match(homepage, /containsTransportPolicyClaim\(`\$\{title\} \$\{text\}`\)\s*\? transportPolicyDisclosure/);
  assert.match(homepage, /normalizeTransportTrustItems\(\s*filterHomepageTrustItems\(parsePairs\(content\.trustItems, defaultTrustItems\)\)/);
  assert.match(pricePage, /transportPolicy\.freeFromThreshold/);
  assert.match(pricePage, /transportPolicy\.belowThreshold/);
  assert.doesNotMatch(homepage, /className="transport-banner"/);
});

test('legacy transport wording from editable content is normalized to the approved rule', () => {
  assert.equal(normalizeHomepageCoverageText('Doprava nad 100 m2 zdarma.'), transportPolicy.full);
  assert.equal(normalizeHomepageCoverageText('Pri ploche od 100 m² dopravu po Slovensku neúčtujeme.'), transportPolicy.full);
  assert.equal(
    normalizeHomepageCoverageText('Prípadná doprava je samostatne uvedená v cenovej ponuke.'),
    transportPolicy.full,
  );
  assert.deepEqual(
    filterHomepageTrustItems([['Doprava podľa zákazky', 'Prípadná doprava je samostatne uvedená v cenovej ponuke.']]),
    [[transportPolicy.title, transportPolicy.full]],
  );
  assert.equal(
    normalizeHomepageCoverageText('Zákazky riešime po celom Slovensku podľa rozsahu a kapacity.'),
    'Zákazky riešime po celom Slovensku podľa rozsahu a kapacity.',
  );
  assert.match(homepage, /whyCoverageText: normalizeTransportDisclosureText\(\s*normalizeHomepageCoverageText\(normalizedContent\.whyCoverageText/);
});

test('contact preference explains why email stays required for the written offer', () => {
  assert.match(homepage, /Ako vás máme prednostne kontaktovať\?/);
  assert.match(homepage, /Vyberte, či vám máme prednostne zavolať alebo napísať\. Cenovú ponuku vám pošleme na uvedený email\./);
  assert.match(homepage, /<input id="email" name="email" type="email"[^>]*required/);
});

test('admin exposes only homepage fields whose saved value is rendered', () => {
  assert.match(defaults, /export const homepageEditableKeys = \[/);
  assert.match(admin, /homepageEditableKeys\.map\(\(key\) =>/);
  assert.doesNotMatch(admin, /Object\.entries\(content\)/);
  assert.doesNotMatch(defaults.match(/export const homepageEditableKeys = \[([\s\S]*?)\] as const/)?.[1] ?? '', /whySafeText|whyDocumentationText|whyRemovalText|whyItems/);
});

test('regional quick answer uses grammatical location text once in the visible page', () => {
  assert.match(seo, /ASTANA, s\.r\.o\. so sídlom v Poprade zabezpečuje po dohode odbornú likvidáciu azbestu a eternitu v \$\{location\.area\}/);
  assert.match(seo, /Výjazd a termín potvrdíme podľa obce, rozsahu prác a aktuálnej kapacity; v tejto lokalite nemáme pobočku/);
  const locationPage = seo.slice(seo.indexOf('export function LocationPage'));
  assert.doesNotMatch(locationPage, /v lokalite \$\{location\.area\}/);
  assert.doesNotMatch(locationPage, /v lokalite \$\{location\.name\}/);
  assert.match(locationPage, /Čo poslať v dopyte na cenovú ponuku\?/);
  assert.equal((locationPage.match(/<QuickAnswer>\{quickAnswer\}<\/QuickAnswer>/g) || []).length, 0);
});

test('homepage and public footer link to every existing regional page', () => {
  const footer = readFileSync(new URL('../app/public-layout.tsx', import.meta.url), 'utf8');
  const regions = ['poprad', 'kosice', 'presov', 'zilina', 'bratislava', 'banska-bystrica', 'nitra', 'trnava', 'trencin'];
  for (const region of regions) {
    const link = new RegExp(`href="/likvidacia-azbestu-${region}/"`);
    assert.match(homepage, link, `homepage odkazuje na ${region}`);
    assert.match(footer, link, `verejná pätička odkazuje na ${region}`);
  }
});

test('regional prompt copy avoids unsupported claims about what is typical in a region', () => {
  const content = readFileSync(new URL('../src/content/seo-content.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(content, /localNote: '[^']*(?:často rozhoduje|býva dôležité|často pomôže)/i);
  assert.match(content, /localNote: 'Poprad je sídlom ASTANY/);
});

test('regional service pages offer an internal path to verified work examples', () => {
  assert.match(seo, /\['\/realizacie\/', 'Ukážky realizácií'\]/);
});

test('realization photos keep their individual factual alt text', () => {
  assert.doesNotMatch(photoReferences, /neutralAltByCategory/);
  assert.match(photoReferences, /asset\(7, 'Strešná konštrukcia po demontáži',[\s\S]*'Strešná konštrukcia po odstránení azbestocementovej krytiny'/);
  assert.match(photoReferences, /\r?\n\s*alt,\r?\n\s*title,/);
});
