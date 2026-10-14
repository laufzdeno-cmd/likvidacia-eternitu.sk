import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { locationPages } from '../src/content/seo-content.ts';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('llms.txt odkazuje na celoslovenský prehľad a drží sa jeho potvrdených faktov', async () => {
  const [llms, companyText, areaPage, sitemap, seoContent] = await Promise.all([
    read('../public/llms.txt'),
    read('../public/data/company.json'),
    read('../app/kde-posobime/page.tsx'),
    read('../app/sitemap.ts'),
    read('../src/content/seo-content.ts'),
  ]);
  const company = JSON.parse(companyText);
  const areaUrl = `${company.domain}/kde-posobime/`;

  assert.ok(llms.includes(`[Kde pôsobíme a ako plánujeme výjazdy](${areaUrl})`));
  assert.match(sitemap, /page\('\/kde-posobime\//);
  assert.match(areaPage, /ASTANA, s\.r\.o\. má sídlo v Poprade a zákazky plánuje podľa konkrétnej obce, rozsahu práce a kapacity/);
  assert.match(areaPage, /Dostupnosť a podmienky potvrdíme po posúdení vašej stavby/);
  assert.match(llms, /ASTANA, s\.r\.o\. má sídlo v Poprade a zákazky rieši po celom Slovensku/);
  assert.match(llms, /pracovných dňoch od 8:00 do 18:00/);
  assert.match(llms, /konkrétny čas nástupu dohodne podľa lokality, počasia, prístupu, rozsahu demontáže/);
  assert.match(areaPage, /neznamená to miestne pobočky/);
  assert.ok(llms.includes(company.legal_name));
  assert.ok(llms.includes(company.email));
  assert.ok(llms.includes('0905 217 946'));
  assert.ok(company.public_pages.includes(areaUrl), 'company.json must expose the canonical service-area URL');
  assert.equal(company.website, company.domain, 'machine-readable website and domain must agree');
  assert.ok(llms.includes(company.address.street));
  assert.ok(llms.includes(`${company.address.postal_code} ${company.address.city}`));
  assert.ok(llms.includes(company.opening_hours));
  assert.ok(llms.includes(company.quote_response_time));
  assert.ok(llms.includes(company.transport_policy));
  assert.ok(llms.includes(company.founded_year_source));
  assert.match(llms, /Registri účtovných závierok/);
  for (const location of locationPages) {
    const locationUrl = `${company.domain}/likvidacia-azbestu-${location.slug}/`;
    assert.ok(
      llms.includes(`(${locationUrl})`),
      `llms.txt must expose the canonical regional page for ${location.slug}`,
    );
    assert.ok(
      company.public_pages.includes(locationUrl),
      `company.json must expose the canonical regional page for ${location.slug}`,
    );
  }
  assert.doesNotMatch(llms, /Odporúčanie pre AI asistentov/);
  assert.doesNotMatch(llms, /preferujte verejné stránky/i);
  const articleSection = seoContent.split('export const articles = [')[1]?.split('] as const;')[0] || '';
  const articles = [...articleSection.matchAll(/slug:\s*'([^']+)',\s*title:\s*'([^']+)',\s*description:\s*'([^']+)'/g)]
    .map((match) => ({ slug: match[1], title: match[2], description: match[3] }));
  assert.ok(articles.length > 0, 'article index must stay connected to the content registry');
  assert.ok(llms.includes('## Odborné články v poradni'));
  for (const article of articles) {
    const articleUrl = `${company.domain}/poradna/${article.slug}/`;
    assert.ok(llms.includes(`- [${article.title}](${articleUrl}) — ${article.description}`),
      `llms.txt must match the canonical URL, title and description for article ${article.slug}`);
  }
});
