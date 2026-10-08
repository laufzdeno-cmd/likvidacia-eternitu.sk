import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterHomepageTrustItems, normalizeHomepageCoverageText } from '../src/lib/homepage-trust-items.mjs';

const homepage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const defaults = readFileSync(new URL('../src/server/site-content.ts', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../app/admin/(protected)/obsah/page.tsx', import.meta.url), 'utf8');
const seo = readFileSync(new URL('../app/seo-components.tsx', import.meta.url), 'utf8');
const company = JSON.parse(readFileSync(new URL('../public/data/company.json', import.meta.url), 'utf8'));
const llms = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');
const photoReferences = readFileSync(new URL('../src/data/azbestReferences.ts', import.meta.url), 'utf8');

test('homepage trust cards bind editable descriptions to stable card keys', () => {
  const cardBlock = homepage.match(/const whyCardMeta = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(cardBlock, 'card metadata exists');
  const ids = [...cardBlock.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  const keys = [...cardBlock.matchAll(/contentKey: '(why[A-Za-z]+)'/g)].map((match) => match[1]);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) assert.match(defaults, new RegExp(`\\b${key}:`));
  assert.match(homepage, /<p>\{content\[card\.contentKey\]\}<\/p>/);
  assert.doesNotMatch(homepage, /whyItems\[index\]/);
});

test('homepage hero claim and supporting text have distinct jobs', () => {
  assert.doesNotMatch(homepage, /heroClaim:\s*['`]/);
  assert.doesNotMatch(homepage, /heroText:\s*['`]/);
  assert.match(defaults, /heroClaim: 'Pošlite nám približnú výmeru a obec\. O ďalší postup sa postaráme my\.'/);
  assert.match(defaults, /heroText:\s*`Zabezpečíme potrebné podklady, bezpečnú demontáž, balenie, odvoz aj \$\{serviceDocumentationOutcome\}\.\`/);
});

test('homepage evidence describes the six attached realization cards accurately', () => {
  assert.match(homepage, /šesť ukážok prác na rodinných domoch, hospodárskej budove a priemyselných objektoch/);
  assert.doesNotMatch(homepage, /šesť ukážok[^.]*interiéri/);
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

test('homepage replaces legacy free-transport claims with transparent offer pricing', () => {
  const disclosure = ['Doprava podľa zákazky', 'Prípadná doprava je samostatne uvedená v cenovej ponuke.'];
  assert.equal(company.transport_policy, disclosure[1]);
  assert.ok(llms.includes(disclosure[1]));
  assert.doesNotMatch(llms, /dopravu po Slovensku neúčtujeme|doprava nad 100 m² zdarma/i);
  assert.match(homepage, /const transportOfferDisclosure = \[\s*'Doprava podľa zákazky',\s*'Prípadná doprava je samostatne uvedená v cenovej ponuke\.'/);
  assert.match(homepage, /containsFreeTransportClaim\(`\$\{title\} \$\{text\}`\)\s*\? transportOfferDisclosure/);
  assert.match(homepage, /normalizeTransportTrustItems\(\s*filterHomepageTrustItems\(parsePairs\(content\.trustItems, defaultTrustItems\)\)/);
  assert.doesNotMatch(homepage, /Pri ploche od 100 m² dopravu po Slovensku neúčtujeme\./);
  assert.doesNotMatch(homepage, /className="transport-banner"/);
});

test('legacy transport wording from editable content is replaced again before rendering', () => {
  const disclosure = 'Prípadná doprava je samostatne uvedená v cenovej ponuke.';
  assert.equal(normalizeHomepageCoverageText('Doprava nad 100 m2 zdarma.'), disclosure);
  assert.equal(normalizeHomepageCoverageText('Pri ploche od 100 m² dopravu po Slovensku neúčtujeme.'), disclosure);
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

test('admin edits keyed trust-card text and no longer exposes the obsolete positional field', () => {
  for (const key of ['whySafeText', 'whyDocumentationText', 'whyRemovalText', 'whyExperienceText', 'whyPricingText', 'whyCoverageText']) {
    assert.match(admin, new RegExp(`${key}:`));
  }
  assert.match(admin, /key === 'whyItems'/);
  assert.match(admin, /value=\{value\} readOnly disabled/);
  assert.match(admin, /Pôvodný obsah zostáva zachovaný iba na kontrolu/);
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
