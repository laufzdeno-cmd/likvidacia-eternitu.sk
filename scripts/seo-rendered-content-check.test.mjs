import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checker = path.join(projectRoot, 'scripts/seo-rendered-content-check.mjs');
const site = 'https://likvidacia-eternitu.sk';

function html(title, description, content) {
  return `<!doctype html><html lang="sk"><head><title>${title}</title><meta name="description" content="${description}"></head><body><main>${content}</main></body></html>`;
}

function run(outputRoot, publicRoot) {
  return spawnSync(process.execPath, [checker], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ASTANA_SEO_OUTPUT_ROOT: outputRoot,
      ASTANA_SEO_PUBLIC_ROOT: publicRoot,
      ASTANA_SEO_BUILD_ID: path.join(path.dirname(outputRoot), 'BUILD_ID'),
    },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('rendered content checker detects duplicate metadata, H1, broken routes and anchors', async () => {
  const ownedRoot = await mkdtemp(path.join(projectRoot, '.astana-seo-fixture-'));
  const outputRoot = path.join(ownedRoot, 'app');
  const publicRoot = path.join(ownedRoot, 'public');
  try {
    await mkdir(outputRoot);
    await mkdir(publicRoot);
    await writeFile(path.join(ownedRoot, 'BUILD_ID'), 'seo-fixture-build-001');
    await writeFile(path.join(outputRoot, 'sitemap.xml.body'), `<urlset><url><loc>${site}/</loc></url><url><loc>${site}/about/</loc></url><url><loc>${site}/realizacie/</loc></url></urlset>`);
    await writeFile(path.join(outputRoot, 'index.html'), html('Úvod ASTANA', 'Úvodná stránka ASTANA.', '<h1>Úvod</h1><a href="/about/#team">O tíme</a>'));
    await writeFile(path.join(outputRoot, 'about.html'), html('O nás ASTANA', 'O našom tíme ASTANA.', '<h1>O nás</h1><section id="team">Tím</section>'));
    const healthy = run(outputRoot, publicRoot);
    assert.equal(healthy.status, 0, `${healthy.stdout}\n${healthy.stderr}`);
    assert.match(healthy.stdout, /build seo-fixture-build-001/);
    assert.match(healthy.stdout, /PASS: build seo-fixture-build-001; H1, title, description/);

    await writeFile(path.join(outputRoot, 'index.html'), html('Úvod ASTANA', 'Úvodná stránka ASTANA.',
      '<h1>Úvod</h1><h1>Druhý nadpis</h1><a href="/about/#missing">Zlá kotva</a><a href="/missing/">Zlá cesta</a>'));
    await writeFile(path.join(outputRoot, 'about.html'), html('Úvod ASTANA', 'Úvodná stránka ASTANA.', '<h1>O nás</h1>'));
    const broken = run(outputRoot, publicRoot);
    assert.equal(broken.status, 1, `${broken.stdout}\n${broken.stderr}`);
    assert.match(broken.stderr, /presne jeden neprázdny H1/);
    assert.match(broken.stderr, /rovnaký title/);
    assert.match(broken.stderr, /rovnaký description/);
    assert.match(broken.stderr, /interný odkaz nemá známy cieľ \/missing\//);
    assert.match(broken.stderr, /kotva \/about\/#missing na statickom cieli neexistuje/);

    await writeFile(path.join(outputRoot, 'index.html'), html('Úvod ASTANA', 'Úvodná stránka ASTANA.', '<h1>Úvod</h1><a href="/about/#team">O tíme</a>'));
    await writeFile(path.join(outputRoot, 'about.html'), html('O nás ASTANA', 'O našom tíme ASTANA.', '<h1>O nás</h1><section id="team">Tím</section>'));
    await writeFile(path.join(outputRoot, 'sitemap.xml.body'), `<urlset><url><loc>${site}/</loc></url><url><loc>${site}/about/</loc></url><url><loc>${site}/missing/</loc></url></urlset>`);
    const missingPage = run(outputRoot, publicRoot);
    assert.equal(missingPage.status, 1, `${missingPage.stdout}\n${missingPage.stderr}`);
    assert.match(missingPage.stderr, /\/missing\/: stránka zo sitemapy nemá prerenderované HTML/);

    await writeFile(path.join(outputRoot, 'sitemap.xml.body'), `<urlset><url><loc>${site}/</loc></url><url><loc>${site}/about/</loc></url></urlset>`);
    await mkdir(path.join(publicRoot, 'assets'));
    await writeFile(path.join(outputRoot, 'index.html'), html('Úvod ASTANA', 'Úvodná stránka ASTANA.', '<h1>Úvod</h1><a href="/assets/">Adresár nie je súbor</a>'));
    const directoryLink = run(outputRoot, publicRoot);
    assert.equal(directoryLink.status, 1, `${directoryLink.stdout}\n${directoryLink.stderr}`);
    assert.match(directoryLink.stderr, /interný odkaz nemá známy cieľ \/assets\//);

    await rm(path.join(outputRoot, 'index.html'));
    await rm(path.join(outputRoot, 'about.html'));
    const emptyBuild = run(outputRoot, publicRoot);
    assert.equal(emptyBuild.status, 1, `${emptyBuild.stdout}\n${emptyBuild.stderr}`);
    assert.match(emptyBuild.stderr, /žiadnu statickú indexovateľnú stránku/);
  } finally {
    const absolute = path.resolve(ownedRoot);
    const safeParent = path.resolve(projectRoot);
    if (path.dirname(absolute) !== safeParent || path.basename(absolute).indexOf('.astana-seo-fixture-') !== 0) {
      throw new Error('Neočakávaná cesta dočasnej SEO skúšky; odmietam ju odstrániť.');
    }
    await rm(absolute, { recursive: true, force: true });
  }
});
