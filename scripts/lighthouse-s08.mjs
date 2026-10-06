import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createLighthouseNetworkProxy } from './lighthouse-network-proxy.mjs';
import { runBoundedChild } from './bounded-child-output.mjs';
import {
  summarizeLighthouseAudit,
  summarizeLighthouseLcpBreakdown,
  summarizeLighthouseNode,
  safeLighthousePath,
} from './lighthouse-report-summary.mjs';

const lighthouseVersion = '13.5.0';
const baseUrl = process.env.ASTANA_LIGHTHOUSE_BASE_URL;
const reportRoot = process.env.ASTANA_LIGHTHOUSE_REPORT_ROOT;
const tempRoot = process.env.ASTANA_HARNESS_TEMP_ROOT;
const chromePath = process.env.CHROME_PATH;
assert.ok(baseUrl && reportRoot && tempRoot && chromePath, 'S08 requires an explicit local origin, owned temp report directory and Chromium path.');
const origin = new URL(baseUrl);
assert.ok(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname), 'S08 may only audit a loopback HTTP origin.');
assert.equal(origin.pathname, '/');
assert.equal(origin.search, '');
assert.equal(origin.hash, '');
const ownedTempRoot = path.resolve(tempRoot);
const resolvedReportRoot = path.resolve(reportRoot);
assert.ok(resolvedReportRoot.startsWith(ownedTempRoot + path.sep), 'S08 reports must stay inside the isolated harness temp tree.');
assert.ok(existsSync(chromePath), `Configured Chromium executable is missing: ${chromePath}`);
mkdirSync(resolvedReportRoot, { recursive: true });
const isolatedNpmConfig = path.join(resolvedReportRoot, 'npmrc');
writeFileSync(isolatedNpmConfig, 'registry=https://registry.npmjs.org/\nalways-auth=false\n', { flag: 'wx' });

const npmCliPath = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
assert.ok(existsSync(npmCliPath), `Isolated npm CLI is missing beside Node: ${npmCliPath}`);
const installRoot = path.join(resolvedReportRoot, 'npm-packages');
mkdirSync(installRoot, { recursive: true });
const minimalEnvironment = Object.fromEntries(
  ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC']
    .filter((key) => process.env[key]).map((key) => [key, process.env[key]]),
);
const install = spawnSync(process.execPath, [npmCliPath, 'install', '--prefix', installRoot,
  '--no-save', '--package-lock=false', '--ignore-scripts', '--audit=false', '--fund=false', `lighthouse@${lighthouseVersion}`], {
  cwd: installRoot,
  env: {
    ...minimalEnvironment,
    NPM_CONFIG_CACHE: path.join(resolvedReportRoot, 'npm-cache'),
    NPM_CONFIG_USERCONFIG: isolatedNpmConfig,
    NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/',
  },
  windowsHide: true,
  encoding: 'utf8',
  timeout: 180_000,
  maxBuffer: 4 * 1024 * 1024,
});
assert.equal(install.status, 0, `Isolated Lighthouse installation failed: ${(install.stderr || install.stdout || install.error?.message || 'unknown error').slice(-4000)}`);
const lighthouseCliPath = path.join(installRoot, 'node_modules', 'lighthouse', 'cli', 'index.js');
assert.ok(existsSync(lighthouseCliPath), 'Pinned Lighthouse CLI did not install at the expected package entry point.');

// Chromium is forced through an allowlist proxy that forwards only the exact
// app origin; other ports, IP literals, schemes and CONNECT are denied.
const networkProxy = await createLighthouseNetworkProxy(origin.origin);
const proxyPort = networkProxy.port;

function runLighthouse(args, timeoutMs) {
  return runBoundedChild(process.execPath, ['--trace-uncaught', lighthouseCliPath, ...args], {
    cwd: installRoot,
    env: { ...minimalEnvironment, CHROME_PATH: chromePath },
    timeoutMs,
    maxStdoutBytes: 24 * 1024 * 1024,
    maxStderrBytes: 4 * 1024 * 1024,
  });
}

const smokeMode = process.env.ASTANA_LIGHTHOUSE_SMOKE === '1';
const diagnosticMode = process.env.ASTANA_LIGHTHOUSE_DIAGNOSTIC === '1';
const auditedPages = [
  { key: 'homepage', path: '/' },
  { key: 'price', path: '/cena-likvidacie-azbestu/' },
  { key: 'realizations', path: '/realizacie/' },
  { key: 'article', path: '/poradna/co-je-eternit-a-kedy-obsahuje-azbest/' },
  { key: 'career', path: '/kariera/' },
];
const pages = smokeMode ? [auditedPages[0]] : auditedPages;
const runsPerPage = smokeMode || diagnosticMode ? 1 : 3;
const results = [];
const chromeFlags = [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--disable-quic',
  `--proxy-server=http://127.0.0.1:${proxyPort}`, '--proxy-bypass-list=<-loopback>',
].join(' ');

for (const page of pages) {
  const runs = [];
  for (let index = 1; index <= runsPerPage; index += 1) {
    const url = new URL(page.path, origin).href;
    const lighthouseArgs = [
      url,
      '--form-factor=mobile', '--throttling-method=simulate',
      '--only-categories=performance,accessibility,seo',
      '--blocked-url-patterns=https://*',
      '--output=json', '--output-path=stdout',
      `--chrome-flags=${chromeFlags}`, '--verbose',
    ];
    const completed = await runLighthouse(lighthouseArgs, 120_000);
    assert.equal(completed.status, 0, `Lighthouse ${page.key} run ${index} failed: ${(completed.stdout || '')}\n${completed.stderr || completed.error?.message || 'unknown error'}`.slice(-7000));
    const report = JSON.parse(completed.stdout);
    assert.equal(new URL(report.finalUrl).origin, origin.origin, 'Lighthouse must remain on the isolated local origin.');
    assert.equal(report.runtimeError, undefined, `Lighthouse reported a runtime error for ${url}`);
    const score = (category) => Math.round(report.categories[category].score * 100);
    const lcpMs = report.audits['largest-contentful-paint']?.numericValue;
    const observedLcpMs = report.audits.metrics?.details?.items?.[0]?.observedLargestContentfulPaint;
    const cls = report.audits['cumulative-layout-shift']?.numericValue;
    const lcpInsightItems = report.audits['lcp-breakdown-insight']?.details?.items || [];
    const discoveryInsightItems = report.audits['lcp-discovery-insight']?.details?.items || [];
    const findNode = (items) => {
      for (const item of items) {
        if (item?.type === 'node') return item.node || item;
        if (item?.node?.type === 'node') return item.node.node || item.node;
        if (Array.isArray(item?.items)) {
          const nested = findNode(item.items);
          if (nested) return nested;
        }
      }
      return null;
    };
    const lcpElementItems = report.audits['largest-contentful-paint-element']?.details?.items || [];
    const lcpNode = findNode(lcpInsightItems) || findNode(discoveryInsightItems) || findNode(lcpElementItems);
    const breakdownTable = lcpInsightItems.find((item) => item?.type === 'table');
    const lcpBreakdown = summarizeLighthouseLcpBreakdown(breakdownTable?.items || []);
    const discovery = discoveryInsightItems.find((item) => item?.type === 'checklist');
    const discoveryRows = Array.isArray(discovery?.items)
      ? discovery.items
      : discovery?.items && typeof discovery.items === 'object'
        ? Object.entries(discovery.items).map(([label, value]) => ({ label, value }))
        : [];
    const diagnosticAuditIds = [
      'largest-contentful-paint-element',
      'render-blocking-resources',
      'network-dependency-tree-insight',
      'server-response-time',
      'unused-css-rules',
      'unused-javascript',
    ];
    const diagnosticAudits = diagnosticMode ? Object.fromEntries(diagnosticAuditIds
      .filter((id) => report.audits[id])
      .map((id) => [id, summarizeLighthouseAudit(report.audits[id], origin.origin)])) : null;
    const criticalAssets = diagnosticMode
      ? (report.audits['network-requests']?.details?.items || [])
        .filter((item) => ['Stylesheet', 'Script', 'Image', 'Font'].includes(item.resourceType))
        .sort((left, right) => (right.transferSize || 0) - (left.transferSize || 0))
        .slice(0, 10)
        .map((item) => ({
          path: safeLighthousePath(item.url, origin.origin),
          type: item.resourceType,
          transferBytes: Number.isFinite(item.transferSize) ? Math.round(item.transferSize) : null,
          resourceBytes: Number.isFinite(item.resourceSize) ? Math.round(item.resourceSize) : null,
          startTimeMs: Number.isFinite(item.startTime) ? Math.round(item.startTime) : null,
          endTimeMs: Number.isFinite(item.endTime) ? Math.round(item.endTime) : null,
          durationMs: Number.isFinite(item.duration) ? Math.round(item.duration) : null,
          renderBlocking: ['blocking', 'non-blocking'].includes(item.renderBlocking) ? item.renderBlocking : null,
        }))
      : null;
    assert.ok(Number.isFinite(lcpMs) && Number.isFinite(cls), `Required LCP/CLS metrics missing for ${url}`);
    runs.push({
      run: index,
      performance: score('performance'),
      accessibility: score('accessibility'),
      seo: score('seo'),
      lcpMs: Math.round(lcpMs),
      observedLcpMs: Number.isFinite(observedLcpMs) ? Math.round(observedLcpMs) : null,
      cls: Number(cls.toFixed(4)),
      lcpElementFound: Boolean(lcpNode),
      ...(diagnosticMode ? {
        lcpElement: summarizeLighthouseNode(lcpNode),
        lcpBreakdown,
        lcpDiscovery: discoveryRows.slice(0, 12).map((item) => ({
          pass: typeof item.pass === 'boolean' ? item.pass : null,
          value: typeof item.value === 'boolean' ? item.value : null,
        })),
        diagnosticAudits,
        criticalAssets,
      } : {}),
      report: `${page.key}-${index}.json`,
    });
  }
  const median = (key) => [...runs.map((run) => run[key])].sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  const summary = {
    key: page.key,
    path: page.path,
    runs,
    medianPerformance: median('performance'),
    medianAccessibility: median('accessibility'),
    medianSeo: median('seo'),
    medianLcpMs: median('lcpMs'),
    medianCls: median('cls'),
  };
  summary.pass = summary.medianPerformance >= 90 && summary.medianLcpMs <= 2500 && summary.medianCls <= 0.1;
  results.push(summary);
}

const result = {
  result: results.every((item) => item.pass) ? 'PASS' : diagnosticMode ? 'DIAGNOSTIC_ONLY' : 'FAIL',
  lighthouseVersion,
  origin: origin.origin,
  runsPerPage,
  thresholds: { medianPerformance: 90, medianLcpMs: 2500, medianCls: 0.1 },
  results,
  reportDirectory: resolvedReportRoot,
};
const output = diagnosticMode ? {
  result: 'DIAGNOSTIC_ONLY',
  lighthouseVersion,
  runsPerPage,
  pages: result.results.map(({ key, path: pagePath, runs }) => ({
    key, path: pagePath,
    runs: runs.map(({ lcpMs, observedLcpMs, lcpElementFound, lcpElement, lcpBreakdown, lcpDiscovery, diagnosticAudits, criticalAssets }) => ({ lcpMs, observedLcpMs, lcpElementFound, lcpElement, lcpBreakdown, lcpDiscovery, diagnosticAudits, criticalAssets })),
  })),
} : result;
console.log(JSON.stringify(output));
if (result.result !== 'PASS' && !diagnosticMode) process.exitCode = 1;
await networkProxy.close();
