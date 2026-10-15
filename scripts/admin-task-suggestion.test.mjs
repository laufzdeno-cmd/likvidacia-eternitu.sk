import assert from 'node:assert/strict';
import test from 'node:test';
import { addBusinessDays, buildAdminTaskSuggestion } from '../src/server/admin-task-suggestion.ts';

const candidates = [
  { id: '00000000-0000-4000-a000-000000000001', email: 'jarka@example.invalid', name: 'Jarka', role: 'OPERATOR' },
  { id: '00000000-0000-4000-a000-000000000002', email: 'slavka@example.invalid', name: 'Slávka', role: 'OPERATOR' },
  { id: '00000000-0000-4000-a000-000000000003', email: 'owner@example.invalid', name: 'Majiteľ', role: 'SUPER_ADMIN' },
];

function suggestion(overrides = {}) {
  return buildAdminTaskSuggestion({
    candidates,
    workItems: [],
    leads: [],
    priority: 'NORMAL',
    visibility: 'TEAM',
    today: '2026-10-16',
    generatedAt: '2026-10-16T08:00:00.000Z',
    ...overrides,
  });
}

test('suggestion uses stable internal id tie-break and never hardcodes a person', () => {
  const result = suggestion();
  assert.equal(result.suggestedOwnerEmail, 'jarka@example.invalid');
  assert.equal(result.reasonCode, 'lowest_open_workload');
  assert.match(result.sourceRevision, /^[a-f0-9]{64}$/);
});

test('less loaded active admin is suggested before overloaded admin', () => {
  const result = suggestion({
    workItems: [{ id: 'task-a', revision: 1, ownerEmail: 'jarka@example.invalid', priority: 'CRITICAL', dueDate: '2026-10-15' }],
    leads: [{ id: 'lead-a', ownerEmail: 'slavka@example.invalid', followupDate: '', updatedAt: '2026-10-16T07:00:00.000Z' }],
  });
  assert.equal(result.suggestedOwnerEmail, 'owner@example.invalid');
  assert.equal(result.loadScore, 0);
});

test('superadmin-only task can only suggest an active superadmin', () => {
  const result = suggestion({ visibility: 'SUPER_ADMIN' });
  assert.equal(result.suggestedOwnerEmail, 'owner@example.invalid');
});

test('suggested due dates skip weekends without calculating a 24-hour promise', () => {
  assert.equal(addBusinessDays('2026-10-17', 0), '2026-10-19');
  assert.equal(addBusinessDays('2026-10-16', 1), '2026-10-19');
  assert.equal(suggestion().suggestedDueDate, '2026-10-20');
});

test('source revision changes when workload changes and stays free of source text', () => {
  const first = suggestion();
  const second = suggestion({ leads: [{ id: 'lead-a', ownerEmail: 'jarka@example.invalid', followupDate: '2026-10-16', updatedAt: '2026-10-16T07:00:00.000Z' }] });
  assert.notEqual(first.sourceRevision, second.sourceRevision);
  assert.doesNotMatch(first.sourceRevision, /jarka|slavka|owner/i);
});
