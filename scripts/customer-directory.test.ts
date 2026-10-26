import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCustomerDirectory, normalizeCustomerPhone } from '../src/server/customer-directory';

test('adresár spojí záznamy podľa emailu alebo normalizovaného slovenského telefónu', () => {
  const records = [
    { kind: 'inquiry' as const, id: 'lead-1', name: 'Ján Novák', email: 'JAN@example.sk', phone: '+421 905 111 222', location: 'Poprad', activityAt: '2026-10-20T10:00:00.000Z', label: 'Dopyt', href: '/admin/dopyty/lead-1' },
    { kind: 'job' as const, id: 'job-1', name: 'Ján Novák', email: 'jan@example.sk', phone: '0905 111 222', location: 'Poprad', activityAt: '2026-10-21T10:00:00.000Z', label: 'Zákazka', href: '/admin/zakazky/job-1' },
    { kind: 'offer' as const, id: 'offer-1', name: 'Ján Novák', email: '', phone: '905111222', location: 'Poprad', activityAt: '2026-10-22T10:00:00.000Z', label: 'CP-1', href: '/admin/ponuky/offer-1' },
  ];
  const result = buildCustomerDirectory(records);
  assert.equal(result.length, 1);
  assert.equal(result[0].inquiries.length, 1);
  assert.equal(result[0].jobs.length, 1);
  assert.equal(result[0].offers.length, 1);
  assert.equal(result[0].latestActivityAt, '2026-10-22T10:00:00.000Z');
  assert.equal(normalizeCustomerPhone('+421 905 111 222'), '0905111222');
});

test('adresár nespája záznamy bez spoločného kontaktu a vie hľadať bez diakritiky', () => {
  const records = [
    { kind: 'inquiry' as const, id: 'lead-a', name: 'Ľuboš Kováč', email: 'lubos@example.sk', phone: '', location: 'Žilina', activityAt: '2026-10-20T10:00:00.000Z', label: 'Dopyt A', href: '/admin/dopyty/lead-a' },
    { kind: 'inquiry' as const, id: 'lead-b', name: 'Mária Malá', email: 'maria@example.sk', phone: '', location: 'Prešov', activityAt: '2026-10-21T10:00:00.000Z', label: 'Dopyt B', href: '/admin/dopyty/lead-b' },
  ];
  assert.equal(buildCustomerDirectory(records).length, 2);
  const filtered = buildCustomerDirectory(records, 'zilina');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Ľuboš Kováč');
});
