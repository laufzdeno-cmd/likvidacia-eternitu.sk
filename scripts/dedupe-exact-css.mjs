import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const safeParse = require('next/dist/compiled/postcss-safe-parser');

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const defaultFiles = [
  'src/styles.css',
  'src/premium-overrides.css',
  'src/final-visual-polish.css',
  'app/realizacie/approved-case-map.module.css',
];

function atRuleContext(rule) {
  const context = [];
  let parent = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule') context.unshift(`@${parent.name.toLowerCase()} ${parent.params.trim()}`);
    else return null;
    parent = parent.parent;
  }
  return context.join(' > ');
}

function isKeyframeRule(rule) {
  let parent = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return true;
    parent = parent.parent;
  }
  return false;
}

function ruleFingerprint(rule) {
  if (isKeyframeRule(rule)) return null;
  const context = atRuleContext(rule);
  if (context === null) return null;
  const declarations = [];
  for (const child of rule.nodes || []) {
    if (child.type === 'comment') continue;
    if (child.type !== 'decl') return null;
    declarations.push(`${child.prop}\u0000${child.value.trim()}\u0000${child.important ? '1' : '0'}`);
  }
  if (declarations.length === 0) return null;
  // Keep the selector byte-for-byte apart from harmless outer whitespace.
  // Collapsing whitespace would also change quoted attribute values, where
  // `[data-label="a  b"]` and `[data-label="a b"]` are different selectors.
  return `${context}\u0001${rule.selector.trim()}\u0001${declarations.join('\u0002')}`;
}

export function dedupeCssText(cssText, from = 'inline.css') {
  const root = safeParse(cssText, { from });
  const rules = [];
  root.walkRules((rule) => {
    const fingerprint = ruleFingerprint(rule);
    if (fingerprint) rules.push({ rule, fingerprint });
  });

  const lastByFingerprint = new Map();
  rules.forEach((entry, index) => lastByFingerprint.set(entry.fingerprint, index));
  const removed = [];
  rules.forEach((entry, index) => {
    if (lastByFingerprint.get(entry.fingerprint) === index) return;
    removed.push({
      line: entry.rule.source?.start?.line ?? null,
      selector: entry.rule.selector,
    });
    entry.rule.remove();
  });

  return { css: root.toString(), removed };
}

export async function runExactCssDedupe({ write = false, files = defaultFiles } = {}) {
  const results = [];
  for (const relativePath of files) {
    const absolutePath = path.resolve(projectRoot, relativePath);
    assert.ok(absolutePath.startsWith(`${projectRoot}${path.sep}`), `CSS path leaves project root: ${relativePath}`);
    const before = await readFile(absolutePath, 'utf8');
    const result = dedupeCssText(before, absolutePath);
    const verification = dedupeCssText(result.css, absolutePath);
    assert.equal(verification.removed.length, 0, `${relativePath} dedupe must be idempotent`);
    if (write && result.removed.length > 0) await writeFile(absolutePath, result.css, 'utf8');
    results.push({
      file: relativePath.replaceAll('\\', '/'),
      removedRules: result.removed.length,
      bytesBefore: Buffer.byteLength(before),
      bytesAfter: Buffer.byteLength(result.css),
      bytesSaved: Buffer.byteLength(before) - Buffer.byteLength(result.css),
    });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const write = process.argv.includes('--write');
  const results = await runExactCssDedupe({ write });
  const summary = {
    mode: write ? 'write' : 'check',
    files: results,
    totalRemovedRules: results.reduce((sum, item) => sum + item.removedRules, 0),
    totalBytesSaved: results.reduce((sum, item) => sum + item.bytesSaved, 0),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
