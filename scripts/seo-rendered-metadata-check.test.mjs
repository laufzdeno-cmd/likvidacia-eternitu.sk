import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checker = path.join(projectRoot, 'scripts/seo-rendered-metadata-check.mjs');
const site = 'https://likvidacia-eternitu.sk';

test('rendered metadata audit reads the selected build and reports its BUILD_ID', async () => {
  const ownedRoot = await mkdtemp(path.join(tmpdir(), 'astana-seo-metadata-'));
  const outputRoot = path.join(ownedRoot, '.next', 'server', 'app');
  const publicRoot = path.join(ownedRoot, 'public');
  const buildIdFile = path.join(ownedRoot, '.next', 'BUILD_ID');
  try {
    await mkdir(outputRoot, { recursive: true });
    await mkdir(path.join(publicRoot, 'assets'), { recursive: true });
    await writeFile(buildIdFile, 'seo-metadata-build-002');
    await writeFile(path.join(publicRoot, 'assets', 'og.jpg'), 'fixture image');
    await writeFile(path.join(outputRoot, 'sitemap.xml.body'),
      `<urlset><url><loc>${site}/</loc></url><url><loc>${site}/recenzie/</loc></url><url><loc>${site}/realizacie/</loc></url></urlset>`);
    await writeFile(path.join(outputRoot, 'index.html'), `<!doctype html><html><head>
      <link rel="canonical" href="${site}/">
      <meta property="og:url" content="${site}/">
      <meta property="og:image" content="${site}/assets/og.jpg">
      <meta name="twitter:image" content="${site}/assets/og.jpg">
      </head><body><h1>ASTANA</h1></body></html>`);

    const result = spawnSync(process.execPath, [checker], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ASTANA_SEO_OUTPUT_ROOT: outputRoot,
        ASTANA_SEO_PUBLIC_ROOT: publicRoot,
        ASTANA_SEO_BUILD_ID: buildIdFile,
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /build seo-metadata-build-002/);
  } finally {
    const absolute = path.resolve(ownedRoot);
    const safeParent = `${path.resolve(tmpdir())}${path.sep}`;
    if (!absolute.startsWith(safeParent) || path.basename(absolute).indexOf('astana-seo-metadata-') !== 0) {
      throw new Error('Neočakávaná cesta dočasnej SEO skúšky; odmietam ju odstrániť.');
    }
    await rm(absolute, { recursive: true, force: true });
  }
});
