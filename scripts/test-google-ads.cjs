const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('app/homepage-critical-client.tsx', 'utf8');
const helperSource = fs.readFileSync('src/lib/google-ads.ts', 'utf8');
const compile = (s) => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const id = '12345678-1234-4234-8234-123456789abc';
let passed = 0;
function check(name, fn) { return Promise.resolve().then(fn).then(() => { passed++; console.log('PASS', name); }); }

function tracking(granted = true) {
  const calls = [], scripts = [], storage = new Map();
  const state = { granted };
  const window = { location: { pathname: '/' }, sessionStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) } };
  const context = vm.createContext({ exports: {}, require: () => ({ hasMarketingConsent: () => state.granted }), window,
    document: { createElement: () => ({}), head: { appendChild: s => scripts.push(s) } } });
  vm.runInContext(compile(helperSource), context);
  const api = context.exports;
  const load = () => {
    window.gtag = (...args) => calls.push(args);
    scripts[0]?.onload();
  };
  return { api, state, scripts, window, calls, load, events: () => calls.filter(c => c[0] === 'event') };
}

function initializer(name) {
  const tree = ts.createSourceFile('client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let value;
  function visit(n) { if(ts.isVariableDeclaration(n) && n.name.getText(tree) === name) value = n.initializer.getText(tree); ts.forEachChild(n, visit); }
  visit(tree); assert.ok(value, name); return value;
}

async function formScenario({ status = 200, valid = true, duplicate = false, opera = false, timeout = false, delay = 0, granted = true } = {}) {
  const tr = tracking(granted); tr.api.syncGoogleAdsConsent(); tr.load();
  const classes = new Set(), values = new Map([['submissionId', id], ['email','qa@example.invalid'], ['city','Test']]);
  let posts = 0, resets = 0, disabled = false, error = '', timeoutMs = 0;
  const button = { dataset: {}, innerHTML: 'Submit', setAttribute: () => { disabled = true; } };
  const form = { classList: { contains: c => classes.has(c), add: c => classes.add(c) }, checkValidity: () => valid,
    reportValidity: () => {}, querySelector: () => button, reset: () => { resets++; values.clear(); } };
  const ctx = vm.createContext({ form, selectedFiles: [], preview: null, Error, AbortController,
    FormData: class { constructor() { this.values = new Map(values); } get(k) { return this.values.get(k); } },
    navigator: { userAgent: opera ? 'OPR/120' : 'Chrome/140' },
    window: { setTimeout: (fn, ms) => { timeoutMs = ms; return timeout ? setTimeout(fn, 15) : setTimeout(fn, ms); }, clearTimeout },
    fetch: async (url, init) => { posts++; assert.equal(url,'/api/dopyt/'); assert.equal(init.method,'POST');
      if(timeout) return new Promise((_,reject) => init.signal.addEventListener('abort',()=>{ const e=new Error('timeout');e.name='AbortError';reject(e); }));
      if(delay) await new Promise(r => setTimeout(r,delay));
      return { ok: status===200, headers: { get: () => 'application/json' }, json: async () => ({ok:status===200,message:'Test'}) }; },
    ensureSubmissionId: () => {}, clearStatus: () => {}, updateFileInput: () => {}, trackAnalytics: () => {}, dispatchMetaLead: () => {},
    trackGoogleAdsConversion: tr.api.trackGoogleAdsConversion,
    setStatus: (message,type) => { if(type==='error') error=message; },
    setFormSubmitting: (busy) => { busy ? classes.add('is-submitting') : classes.delete('is-submitting'); },
  });
  vm.runInContext(compile(`const submitLeadForm = ${initializer('submitLeadForm')}; const onSubmit = ${initializer('onSubmit')}; globalThis.run = onSubmit;`),ctx);
  const event = { preventDefault: () => {} };
  const promise = ctx.run(event);
  if(duplicate) await ctx.run(event);
  if(delay) { await new Promise(r => setTimeout(r,4500)); assert.equal(resets,0); assert.equal(tr.events().length,0); }
  await promise;
  assert.equal(posts, valid ? 1 : 0);
  assert.equal(tr.events().length, valid && status===200 && !timeout && granted ? 1 : 0);
  if(timeout || status!==200) { assert.equal(resets,0); assert.equal(values.get('city'),'Test'); assert.ok(error); }
  if(valid) assert.equal(timeoutMs,30000);
  if(valid && status===200 && !timeout) assert.ok(disabled);
}

(async () => {
  await check('exact conversion destination, consent denied never loads tag', () => { const t=tracking(false); t.api.syncGoogleAdsConsent(); assert.equal(t.scripts.length,0); assert.equal(t.api.trackGoogleAdsConversion(id),false); });
  await check('granted success, dedupe and transaction id', () => { const t=tracking(); t.api.trackGoogleAdsConversion(id); t.api.trackGoogleAdsConversion(id); assert.equal(t.scripts.length,1); t.load(); assert.equal(t.events().length,1); assert.equal(t.events()[0][2].send_to,'AW-980634648/sGxDCOjcmOEcEJiYzdMD'); assert.equal(t.events()[0][2].transaction_id,id); });
  await check('revocation before tag load cancels queued conversion', () => { const t=tracking(); t.api.trackGoogleAdsConversion(id); t.state.granted=false;t.api.syncGoogleAdsConsent();t.load();t.state.granted=true;t.api.syncGoogleAdsConsent(); assert.equal(t.events().length,0); });
  await check('denied success is not replayed on consent grant', () => { const t=tracking(false);t.api.trackGoogleAdsConversion(id);t.state.granted=true;t.api.syncGoogleAdsConsent();t.load();assert.equal(t.events().length,0); });
  await check('invalid id rejected and admin tag excluded', () => {const t=tracking();assert.equal(t.api.trackGoogleAdsConversion('bad'),false);t.window.location.pathname='/admin/dashboard/';t.api.syncGoogleAdsConsent();assert.equal(t.scripts.length,0);});
  await check('tag failure does not throw', () => {const t=tracking();t.api.trackGoogleAdsConversion(id);t.scripts[0].onerror();assert.equal(t.events().length,0);});
  await check('successful form: one POST, one event', () => formScenario());
  await check('Opera: one POST, one event', () => formScenario({opera:true}));
  await check('double click: one POST, one event', () => formScenario({duplicate:true}));
  await check('HTTP 500: no event, values preserved', () => formScenario({status:500}));
  await check('timeout: 30000 ms configured, no event, values preserved (accelerated timer)', () => formScenario({timeout:true}));
  await check('invalid form: no POST, no event', () => formScenario({valid:false}));
  await check('denied successful form: no event', () => formScenario({granted:false}));
  await check('5.5 seconds: still waiting at 4.5, one POST then one event', () => formScenario({delay:5500}));
  await check('transport guards and Meta success dispatch preserved', () => {
    assert.doesNotMatch(source,/HTMLFormElement\.prototype\.submit/);
    assert.match(source,/if \(!response\.ok \|\| !result\.ok\)/);
    assert.match(source,/if \(result\.metaLead\) dispatchMetaLead\(result\.metaLead\)/);
    assert.match(source,/const result = await submitLeadForm\(payload\);\s*trackGoogleAdsConversion/);
    assert.equal((source.match(/trackGoogleAdsConversion\(String/g)||[]).length,1);
  });
  await check('release integration present', () => {assert.match(fs.readFileSync('app/layout.tsx','utf8'),/<GoogleAdsTag \/>/);assert.match(fs.readFileSync('next.config.mjs','utf8'),/https:\/\/www.googletagmanager.com/);});
  console.log(`${passed}/${passed} PASS; no network, database or email used.`);
})().catch(e => {console.error(e);process.exitCode=1;});
