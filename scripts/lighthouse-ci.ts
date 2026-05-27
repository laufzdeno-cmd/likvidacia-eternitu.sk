import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const urls = [
  'https://likvidacia-eternitu.sk/',
  'https://likvidacia-eternitu.sk/postup/',
  'https://likvidacia-eternitu.sk/faq/',
];

const thresholds = {
  performance: 90,
  accessibility: 98,
  seo: 98,
};

type Result = {
  url: string;
  performance: number;
  accessibility: number;
  seo: number;
  lcp: string;
  cls: string;
  tbt: string;
  reportPath: string;
};

const resultsDir = path.join(process.cwd(), 'test-results');
mkdirSync(resultsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = path.join(resultsDir, `lighthouse-${stamp}.json`);
const tempDir = path.join(resultsDir, `lighthouse-ci-${stamp}`);
mkdirSync(tempDir, { recursive: true });

function runLighthouse(url: string, index: number) {
  const reportPath = path.join(tempDir, `page-${index + 1}.json`);
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const lighthouseArgs = [
    '--yes',
    'lighthouse@latest',
    url,
    '--form-factor=mobile',
    '--throttling-method=simulate',
    '--output=json',
    `--output-path=${reportPath}`,
    '--chrome-flags=--headless=new --disable-gpu --no-sandbox',
    '--quiet',
  ];
  const args = process.platform === 'win32' ? ['/c', 'npx', ...lighthouseArgs] : lighthouseArgs;
  const completed = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8' });
  if (completed.status !== 0 && !existsSync(reportPath)) {
    throw new Error(`Lighthouse zlyhal pre ${url}: ${completed.error?.message || completed.stderr || completed.stdout || 'neznáma chyba'}`);
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const score = (category: string) => Math.round(report.categories[category].score * 100);
  return {
    url,
    performance: score('performance'),
    accessibility: score('accessibility'),
    seo: score('seo'),
    lcp: report.audits['largest-contentful-paint']?.displayValue || '',
    cls: report.audits['cumulative-layout-shift']?.displayValue || '',
    tbt: report.audits['total-blocking-time']?.displayValue || '',
    reportPath,
  } satisfies Result;
}

const results = urls.map(runLighthouse);
const failures = results.flatMap((result) => {
  const failed: string[] = [];
  if (result.performance < thresholds.performance) failed.push(`${result.url} Performance ${result.performance} < ${thresholds.performance}`);
  if (result.accessibility < thresholds.accessibility) failed.push(`${result.url} Accessibility ${result.accessibility} < ${thresholds.accessibility}`);
  if (result.seo < thresholds.seo) failed.push(`${result.url} SEO ${result.seo} < ${thresholds.seo}`);
  return failed;
});

writeFileSync(
  outputPath,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      thresholds,
      results,
      ok: failures.length === 0,
      failures,
    },
    null,
    2,
  ),
);

console.log(`Lighthouse CI výsledok: ${outputPath}`);
for (const result of results) {
  console.log(`${result.url} P${result.performance} A${result.accessibility} SEO${result.seo} LCP ${result.lcp}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
