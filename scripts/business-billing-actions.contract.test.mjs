import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('financial actions are CSRF-protected, super-admin only and use stable operation IDs', async () => {
  const actions = await readFile(new URL('../app/admin/(protected)/zakazky/actions.ts', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../app/admin/(protected)/zakazky/[id]/billing-panel.tsx', import.meta.url), 'utf8');
  for (const action of ['recordBusinessInvoiceAction', 'cancelBusinessInvoiceAction', 'recordBusinessPaymentAction', 'reverseBusinessPaymentAction']) {
    const start = actions.indexOf(`export async function ${action}`);
    assert.notEqual(start, -1, `${action} musí existovať`);
    const next = actions.indexOf('\nexport async function ', start + 1);
    const body = actions.slice(start, next === -1 ? actions.length : next);
    assert.match(body, /await verifyCsrf\(formData\)/);
    assert.match(body, /await requireSuperAdmin\(\)/);
  }
  assert.match(panel, /name="_csrf"/);
  assert.match(panel, /name="operationId"/);
  assert.match(panel, /role=\{state\.ok \? 'status' : 'alert'\}/);
  assert.match(actions, /values: Object\.fromEntries/);
  assert.match(panel, /key=\{`invoice-\$\{invoiceState\.revision\}`\}/);
  assert.match(panel, /key=\{`payment-\$\{paymentState\.revision\}`\}/);
  assert.match(panel, /retainedValue\(invoiceState, 'invoiceNumber'\)/);
  assert.match(panel, /retainedValue\(paymentState, 'reference'\)/);
  assert.match(panel, /Finančné údaje: neevidované/);
  assert.match(panel, /Evidovaná cena zákazky ani jej stav platbu nepotvrdzujú/);
  assert.doesNotMatch(panel, /name="dueOn"[^>]*min=/, 'historická faktúra musí umožniť starší dátum splatnosti');
  assert.match(panel, /invoiceBalances/);
  assert.match(panel, /Prijaté/);
  assert.match(panel, /Zostáva/);
  assert.match(panel, /admin-finance-history-cards/);
  assert.match(panel, /cancelReasonCode/);
});

test('financial exports stay separate and require super-admin', async () => {
  const route = await readFile(new URL('../app/admin/(protected)/zakazky/export-financie/route.ts', import.meta.url), 'utf8');
  assert.match(route, /await requireSuperAdmin\(\)/);
  assert.match(route, /=== 'payments' \? 'payments'/);
  assert.match(route, /business_finance_exported/);
  assert.match(route, /Cache-Control': 'private, no-store'/);
});

test('admin copy does not present estimates as payments or accounting profit', async () => {
  const jobForm = await readFile(new URL('../app/admin/(protected)/zakazky/job-form.tsx', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../app/admin/(protected)/dashboard/page.tsx', import.meta.url), 'utf8');
  const year = await readFile(new URL('../app/admin/(protected)/rok/page.tsx', import.meta.url), 'utf8');
  assert.match(jobForm, /Dohodnutý spôsob vyúčtovania/);
  assert.match(jobForm, /Nejde o potvrdenie prijatej úhrady/);
  assert.doesNotMatch(jobForm, />Ziskovosť<|>Tržba<|>Hrubý zisk<|>Marža</);
  assert.match(dashboard, /Financie/);
  assert.match(dashboard, /getBusinessFinanceSummary/);
  assert.doesNotMatch(dashboard, /úhrady sa neevidujú/i);
  assert.match(dashboard, /Prijaté úhrady evidujeme osobitne v sekcii Financie/);
  assert.doesNotMatch(dashboard, /Nezaznamenávajú sa|typ faktúra|typ hotovosť/i);
  assert.match(year, /listBusinessFinanceMonthlySummary/);
  assert.doesNotMatch(year, /<th>Typ: faktúra<\/th>|<th>Typ: hotovosť<\/th>/);
});

test('admin financial evidence formats business units and local dates for people', async () => {
  const audit = await readFile(new URL('../app/admin/(protected)/audit/page.tsx', import.meta.url), 'utf8');
  const jobForm = await readFile(new URL('../app/admin/(protected)/zakazky/job-form.tsx', import.meta.url), 'utf8');
  const detail = await readFile(new URL('../app/admin/(protected)/zakazky/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(audit, /money\.format\(value \/ 100\)/);
  assert.match(audit, /value \/ 100\)} %/);
  assert.match(audit, /paymentMethodLabels/);
  assert.match(audit, /reasonLabels/);
  assert.doesNotMatch(audit, /Sadzba DPH v stotinách percenta/);
  assert.match(jobForm, /timeZone: 'Europe\/Bratislava'/);
  assert.doesNotMatch(jobForm, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(detail, /settings, finance\] = await Promise\.all/);
  assert.doesNotMatch(detail, /const finance = await getBusinessJobFinance/);
  assert.doesNotMatch(detail, /Stav recenzie<select/);
  assert.match(detail, /Otvoriť žiadosť o recenziu/);
  assert.match(detail, /stav po obnovení stránky nestratil/);
});
