import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runBoundedChild } from './bounded-child-output.mjs';

const scriptPath = fileURLToPath(new URL('./lighthouse-s08.mjs', import.meta.url));
const lighthouseSource = await readFile(scriptPath, 'utf8');
const summarySource = await readFile(new URL('./lighthouse-report-summary.mjs', import.meta.url), 'utf8');
const boundedChildSource = await readFile(new URL('./bounded-child-output.mjs', import.meta.url), 'utf8');
const browserHarnessSource = await readFile(new URL('./photo-intake-browser.integration.mjs', import.meta.url), 'utf8');
const childEnv = {
  ...process.env,
  ASTANA_LIGHTHOUSE_BASE_URL: 'https://likvidacia-eternitu.sk/',
  ASTANA_LIGHTHOUSE_REPORT_ROOT: 'C:\\tmp\\astana-owned\\reports',
  ASTANA_HARNESS_TEMP_ROOT: 'C:\\tmp\\astana-owned',
  CHROME_PATH: 'C:\\chrome.exe',
};

const result = spawnSync(process.execPath, [scriptPath], {
  env: childEnv,
  encoding: 'utf8',
  windowsHide: true,
  timeout: 10_000,
});

assert.notEqual(result.status, 0, 'S08 must reject a production URL before launching Lighthouse');
assert.match(result.stderr, /S08 may only audit a loopback HTTP origin/);
assert.doesNotMatch(result.stdout + result.stderr, /lighthouse@13\.5\.0|Starting Chrome/);
assert.match(lighthouseSource, /observedLargestContentfulPaint/);
assert.match(summarySource, /wastedBytes/);
assert.match(lighthouseSource, /resourceBytes/);
assert.match(lighthouseSource, /renderBlocking/);
assert.match(lighthouseSource, /'--output=json', '--output-path=stdout'/,
  'the Lighthouse report must be streamed to memory instead of written to disk');
assert.doesNotMatch(lighthouseSource, /--save-assets|trace\.json|devtoolslog\.json/,
  'raw trace and DevTools artifacts must not be persisted');
assert.match(lighthouseSource, /maxStdoutBytes: 24 \* 1024 \* 1024/,
  'Lighthouse JSON stdout must have a byte limit');
assert.match(boundedChildSource, /stdoutLimitExceeded = true;\s*child\.kill\(\)/);
const oversizedChild = await runBoundedChild(process.execPath, ['-e', "process.stdout.write('x'.repeat(1000000))"], {
  cwd: process.cwd(), env: process.env, timeoutMs: 10_000, maxStdoutBytes: 1024,
});
assert.equal(oversizedChild.stdoutLimitExceeded, true);
assert.equal(oversizedChild.status, null);
assert.ok(oversizedChild.stdoutBytes <= 1024);
assert.ok(oversizedChild.stdout.length <= 1024);
assert.match(browserHarnessSource, /if \(lighthouseS08\) \{/,
  'the browser harness must run Lighthouse in both diagnostic and acceptance modes');
assert.match(browserHarnessSource, /ASTANA_LIGHTHOUSE_DIAGNOSTIC !== '1'/,
  'diagnostic mode must skip only CSS coverage, not the Lighthouse diagnostic run');
assert.match(browserHarnessSource, /ASTANA_LIGHTHOUSE_DIAGNOSTIC === '1' \? '1' : '0'/);
console.log('Lighthouse S08 production-origin and bounded-report guards: PASS');
