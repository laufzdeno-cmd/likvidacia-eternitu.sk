import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('approved case map is server-rendered only from the public allow-list and safe ZBGIS points', async () => {
  const [route, homepage, component, styles, types, mapper] = await Promise.all([
    read('../app/realizacie/page.tsx'),
    read('../app/page.tsx'),
    read('../app/realizacie/approved-case-map.tsx'),
    read('../app/realizacie/approved-case-map.module.css'),
    read('../src/server/types.ts'),
    read('../src/lib/published-realization-locality-points.ts'),
  ]);

  assert.match(route, /countPublishedRealizationCases, listPublishedRealizationCases, listPublishedRealizations/);
  assert.match(route, /listPublishedRealizationCases\(caseStudiesPerPage, \(page - 1\) \* caseStudiesPerPage\)/);
  assert.match(route, /Stránky schválených realizácií/);
  assert.match(route, /casesPage=\$\{currentCasePage \+ 1\}/);
  assert.match(route, /export async function generateMetadata\(\{ searchParams \}: PageProps\)/);
  assert.match(route, /if \(requestedPage === 1\) return pageMetadata;/,
    'the main realizations URL must not wait for a database count before rendering metadata');
  assert.match(route, /canonical: canonicalPage > 1 \? `\/realizacie\/\?casesPage=\$\{canonicalPage\}` : '\/realizacie\/'/);
  assert.match(route, /Promise\.all\(\[[\s\S]*?loadPublishedRealizations\(\),[\s\S]*?loadApprovedCaseStudies\(safeRequestedPage\),[\s\S]*?\]\)/);
  assert.match(route, /async function PublishedRealizationsContent\(\{ searchParams \}: PageProps\)/);
  assert.match(route, /export default function RealizationsPage\(\{ searchParams \}: PageProps\)/,
    'the static page shell must remain synchronous so it can stream before database content');
  assert.match(route, /<Suspense fallback=\{null\}>[\s\S]*?<PublishedRealizationsContent searchParams=\{searchParams\} \/>[\s\S]*?<\/Suspense>/,
    'published database content must stay behind the streaming boundary');
  assert.match(route, /<ApprovedCaseMap cases=\{approvedCaseStudies\} \/>/);
  assert.match(homepage, /<a className="hero-real-note" href="\/realizacie\/">Ukážky reálnych striech ASTANA\.<\/a>/,
    'hlavný odkaz na ukážky musí otvoriť stránku realizácií');
  assert.doesNotMatch(route, /getRealizationCaseDrafts|listRealizationCaseDrafts/);
  assert.doesNotMatch(component, /^\s*['"]use client['"]/);
  assert.match(component, /cases: readonly PublishedRealizationCase\[\]/);
  assert.match(component, /if \(cases\.length === 0\) return null/);
  assert.match(component, /mapPublishedRealizationLocalityPoints\(cases\)/);
  assert.match(component, /`\/api\/realization-case-media\/\$\{encodeURIComponent\(imageId\)\}\/`/);
  assert.match(component, /sizes="\(max-width: 700px\) 100vw, \(max-width: 1100px\) 50vw, 33vw"/);
  assert.match(component, /srcSet=\{`\$\{imagePath\}\?w=360 360w, \$\{imagePath\}\?w=720 720w, \$\{imagePath\}\?w=1080 1080w`\}/);
  assert.match(component, /loading="lazy"/);
  assert.match(component, /decoding="async"/);
  assert.doesNotMatch(component, /\/_next\/image\?url=.*realization-case-media/,
    'odvolateľná fotografia nesmie vstúpiť do cache Next Image');
  assert.match(component, /src="\/assets\/maps\/slovakia-admin-3\.svg"[\s\S]*?unoptimized/,
    'mapové SVG má zostať bez rasterizácie v Next Image');
  assert.match(component, /href="\/likvidacia-azbestu\/">Ako likvidujeme azbest<\/a>/);
  assert.match(component, /href="\/kde-posobime\/">Kde pôsobíme<\/a>/);
  assert.match(component, /aria-label=\{`Súvisiace informácie k realizácii \$\{item\.title\}`\}/);
  assert.match(component, /localityDataset\.attribution|localityDataset\.source/);
  assert.match(component, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(component, /Body zobrazujú približnú obec alebo okres/);
  assert.match(component, /<nav className=\{styles\.markerLinks\} aria-label="Odkazy na realizácie podľa približnej lokality">/);
  assert.match(component, /href=\{`#realizacia-\$\{firstCase\.id\}`\}/);
  assert.match(component, /<details[\s\S]*?className=\{styles\.markerCluster\}[\s\S]*?<summary className=\{styles\.markerLink\}/);
  assert.match(component, /cluster\.cases\.map\(\(item\) =>/);
  assert.match(component, /href=\{`#realizacia-\$\{item\.id\}`\}/);
  assert.match(component, /aria-label=\{label\}/);
  assert.match(component, /const MARKER_CLEARANCE_PX = 48/);
  assert.match(component, /horizontalDistance < MARKER_CLEARANCE_PX && verticalDistance < MARKER_CLEARANCE_PX/);
  assert.match(component, /realizácie v blízkych lokalitách – vybrať realizáciu/);
  assert.match(component, /left: `\$\{\(cluster\.x \/ 720\) \* 100\}%`/);
  assert.match(component, /top: `\$\{\(cluster\.y \/ 420\) \* 100\}%`/);
  assert.match(component, /id=\{`realizacia-\$\{item\.id\}`\}/);
  assert.match(types, /export type PublishedRealizationCase = Pick<RealizationCaseDraft,[\s\S]*?& \{ photoIds: string\[\]; publishedAt: string \}/);
  assert.doesNotMatch(types.match(/export type PublishedRealizationCase = ([\s\S]*?);/)?.[1] ?? '', /publicationEvidence|businessJobId|updatedBy|GPS|email/i);
  assert.match(mapper, /item\.localityPrecision === 'municipality'/);
  assert.match(mapper, /item\.localityPrecision === 'district'/);
  assert.match(mapper, /if \(matches\.length !== 1\) continue/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /\.cards\.cardsOne \{[^}]*justify-content: center/);
  assert.match(styles, /\.cards\.cardsTwo \{[^}]*justify-content: center/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /\.markerLink \{[^}]*width: 44px;[^}]*height: 44px;/);
  assert.match(styles, /\.markerLink:focus-visible \{[^}]*outline: 3px solid/);
  assert.match(styles, /\.clusterCaseList a:focus-visible \{[^}]*outline: 3px solid/);
  assert.match(styles, /\.card:target \{[^}]*outline: 3px solid/);
  assert.match(styles, /\.relatedLinks \{[^}]*display: flex/);
  assert.match(styles, /\.relatedLinks a:focus-visible|\.card a:focus-visible/);
  assert.match(route, /className="published-realization-links"/);
  assert.match(route, /href="\/likvidacia-azbestu\/">Ako likvidujeme azbest<\/a>/);
  assert.match(route, /href="\/kde-posobime\/">Kde pôsobíme<\/a>/);
  assert.doesNotMatch(
    route.match(/src=\{imageUrl\}[\s\S]*?\/>/)?.[0] ?? '',
    /unoptimized/,
    'schválená fotografia realizácie musí používať responzívnu optimalizáciu Next Image',
  );
});
