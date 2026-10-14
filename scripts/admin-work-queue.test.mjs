import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdminWorkQueue, normalizeAdminWorkQueueFilters } from '../src/lib/admin-work-queue.ts';

const today = '2026-10-14';
const manual = (overrides = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Zavolať zákazníkovi', note: 'Overiť termín.', priority: 'NORMAL', dueDate: today,
  ownerEmail: 'operator@local.test', visibility: 'TEAM', status: 'OPEN', revision: 1,
  cancelReason: '', createdBy: 'admin@local.test', completedBy: '', completedAt: '', cancelledBy: '', cancelledAt: '',
  createdAt: '2026-10-14T06:00:00.000Z', updatedAt: '2026-10-14T06:00:00.000Z', ...overrides,
});
const priority = (overrides = {}) => ({
  id: 'new-leads', rank: 20, tone: 'action', eyebrow: 'Nový obchod', title: 'Kontaktujte nové dopyty',
  detail: 'Bez prvého kontaktu.', metric: '2', href: '/admin/dopyty?queue=new', actionLabel: 'Otvoriť', ...overrides,
});

test('unified queue orders overdue automatic and manual work before today and upcoming work', () => {
  const result = buildAdminWorkQueue({
    priorities: [
      priority(),
      priority({ id: 'followups', rank: 10, tone: 'critical', title: 'Follow-upy', timing: 'overdue' }),
      priority({ id: 'planner', rank: 40, title: 'Zajtrajší plán', timing: 'upcoming' }),
    ],
    workItems: [manual({ id: '22222222-2222-4222-8222-222222222222', dueDate: '2026-10-13', priority: 'HIGH' }), manual()],
    today, currentEmail: 'operator@local.test', filters: normalizeAdminWorkQueueFilters({}),
  });
  assert.deepEqual(result.items.map((item) => item.group), ['OVERDUE', 'OVERDUE', 'TODAY', 'TODAY', 'UPCOMING']);
  assert.equal(result.counts.overdue, 2);
  assert.equal(result.counts.today, 2);
  assert.equal(result.counts.mine, 2);
  assert.equal(buildAdminWorkQueue({
    priorities: [priority({ id: 'followups', timing: 'overdue' })], workItems: [], today,
    currentEmail: 'operator@local.test', filters: normalizeAdminWorkQueueFilters({ view: 'overdue' }),
  }).items.length, 1);
});

test('all-clear marker is rendered as an empty state, not a fake work item', () => {
  const result = buildAdminWorkQueue({
    priorities: [priority({ id: 'all-clear', rank: 100, tone: 'stable', title: 'Nič otvorené' })],
    workItems: [], today, currentEmail: 'operator@local.test', filters: normalizeAdminWorkQueueFilters({}),
  });
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.counts, { overdue: 0, today: 0, mine: 0, unassigned: 0, doneToday: 0, cancelled: 0 });
});

test('manual filters distinguish mine, unassigned, done and cancelled without treating automatic work as unassigned', () => {
  const workItems = [
    manual(),
    manual({ id: '22222222-2222-4222-8222-222222222222', ownerEmail: '' }),
    manual({ id: '33333333-3333-4333-8333-333333333333', status: 'DONE', completedAt: '2026-10-14T08:00:00.000Z' }),
    manual({ id: '55555555-5555-4555-8555-555555555555', status: 'DONE', completedAt: '2026-10-13T08:00:00.000Z' }),
    manual({ id: '44444444-4444-4444-8444-444444444444', status: 'CANCELLED', cancelReason: 'Duplicitná úloha' }),
  ];
  const build = (view) => buildAdminWorkQueue({
    priorities: [priority()], workItems, today, currentEmail: 'operator@local.test',
    filters: normalizeAdminWorkQueueFilters({ view }),
  });
  assert.equal(build('mine').items.length, 1);
  assert.equal(build('unassigned').items.length, 1);
  assert.equal(build('done').items.length, 2);
  assert.equal(build('done_today').items.length, 1);
  assert.equal(build('done_today').items[0].status, 'DONE');
  assert.equal(build('cancelled').items[0].status, 'CANCELLED');
  assert.equal(build('all').items.some((item) => item.status !== 'OPEN'), false);
});

test('filter normalization fails closed to supported values and bounded search', () => {
  const filters = normalizeAdminWorkQueueFilters({ view: 'owner-finance', source: 'remote', q: 'x'.repeat(200) });
  assert.equal(filters.view, 'all');
  assert.equal(filters.source, 'all');
  assert.equal(filters.query.length, 80);
});
