import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

const source = readFileSync(new URL('../app/admin/(protected)/health/page.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

function loadPage({ systemHealth, notificationHealth, authorize = async () => {} }) {
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(specifier) {
      if (specifier === 'react/jsx-runtime') return jsxRuntime;
      if (specifier === '@/src/server/db') {
        return { getSystemHealth: systemHealth, getApplicationNotificationHealth: notificationHealth };
      }
      if (specifier === '@/src/server/auth') return { requireSuperAdmin: authorize };
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  return exports.default;
}

function health(databaseOk = true) {
  const feature = { level: 'ok', label: 'OK', detail: 'Overené.' };
  return {
    database: { ok: databaseOk, detail: databaseOk ? 'PostgreSQL odpovedá.' : 'db://user:secret@private-host' },
    leadMail: feature,
    storage: { ok: true, detail: 'Úložisko odpovedá.' },
    smtp: { ok: true, detail: 'SMTP odpovedá.' },
    features: {
      conversion: feature,
      routeDistance: feature,
      leadRetention: feature,
      careerRetention: feature,
      photoIntake: feature,
      operationsAlert: feature,
    },
    buildCommit: 'abcdef123456',
    siteUrl: 'https://example.test',
    allowedOrigins: 'https://example.test',
    lastLead: null,
    lastEmailSent: null,
    lastEmailError: null,
  };
}

test('DB failure keeps health page available without counts or exception details', async () => {
  const page = loadPage({
    systemHealth: async () => health(false),
    notificationHealth: async () => { throw new Error('db://user:secret@private-host'); },
  });
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Kontrola systému/);
  assert.match(html, /Databáza<\/span><strong>Nedostupné/);
  assert.match(html, /Stav databázy sa momentálne nepodarilo overiť/);
  assert.match(html, /Stav notifikácií<\/span><strong>Nedostupné/);
  assert.doesNotMatch(html, /db:\/\/|private-host|Správy pripravené na ďalší pokus/);
});

test('notification query failure does not hide successful system diagnostics', async () => {
  const page = loadPage({
    systemHealth: async () => health(),
    notificationHealth: async () => { throw new Error('private query detail'); },
  });
  const html = renderToStaticMarkup(await page());
  assert.match(html, /PostgreSQL odpovedá/);
  assert.match(html, /Stav notifikácií<\/span><strong>Nedostupné/);
  assert.doesNotMatch(html, /private query detail/);
});

test('unverified database does not turn fallback zero counts into a healthy status', async () => {
  const page = loadPage({
    systemHealth: async () => health(false),
    notificationHealth: async () => ({ pending: 0, failed: 0, unknown: 0, staleSending: 0 }),
  });
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Stav notifikácií<\/span><strong>Nedostupné/);
  assert.doesNotMatch(html, /Čakajúce<\/span><strong>0<\/strong>/);
});

test('a successful query still displays measured notification counts', async () => {
  const page = loadPage({
    systemHealth: async () => health(),
    notificationHealth: async () => ({ pending: 2, failed: 1, unknown: 0, staleSending: 0 }),
  });
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Čakajúce<\/span><strong>2<\/strong>/);
  assert.match(html, /Neúspešné<\/span><strong>1<\/strong>/);
  assert.doesNotMatch(html, /Stav notifikácií<\/span><strong>Nedostupné/);
});

test('system diagnostic rejection renders a safe fallback after authorization', async () => {
  const page = loadPage({
    systemHealth: async () => { throw new Error('private system detail'); },
    notificationHealth: async () => { throw new Error('private query detail'); },
  });
  const html = renderToStaticMarkup(await page());
  assert.match(html, /Diagnostika je nedostupná/);
  assert.doesNotMatch(html, /private system detail|private query detail/);
});

test('authorization failure never starts diagnostics', async () => {
  let called = false;
  const page = loadPage({
    authorize: async () => { throw new Error('unauthorized'); },
    systemHealth: async () => { called = true; return health(); },
    notificationHealth: async () => { called = true; return {}; },
  });
  await assert.rejects(page(), /unauthorized/);
  assert.equal(called, false);
});
