import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { findWorkspaceCapacityWarnings } from '../src/lib/job-workspace-planner.ts';
import { emptyJobWorkspaceOperations } from '../src/server/job-workspace-policy.ts';

function workspace(overrides = {}) {
  const operations = emptyJobWorkspaceOperations();
  Object.assign(operations.plan, { tentativeOn: '2026-11-03', vehicleIds: ['QA-1'], ...overrides });
  return { jobId: randomUUID(), number: randomUUID(), operations };
}
test('same car without exact times is a visible potential collision, normalized by plate', () => {
  const warnings = findWorkspaceCapacityWarnings([workspace(), workspace({ vehicleIds: ['qa 1'] })]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].resource, 'VEHICLE');
  assert.equal(warnings[0].certainty, 'CHECK_TIMES');
});
test('exact non-overlapping windows allow two jobs and overlapping windows flag the crew', () => {
  const worker = randomUUID();
  const first = workspace({ timeFrom: '08:00', timeTo: '10:00', crewIds: [worker] });
  const second = workspace({ timeFrom: '10:00', timeTo: '12:00', crewIds: [worker] });
  assert.deepEqual(findWorkspaceCapacityWarnings([first, second]), []);
  second.operations.plan.timeFrom = '09:30';
  const warnings = findWorkspaceCapacityWarnings([first, second]);
  assert.equal(warnings.length, 2);
  assert.ok(warnings.every((warning) => warning.certainty === 'OVERLAP'));
});
test('same job, actual completed work and different days do not create false conflicts', () => {
  const first = workspace();
  assert.deepEqual(findWorkspaceCapacityWarnings([first, structuredClone(first)]), []);
  assert.deepEqual(findWorkspaceCapacityWarnings([first, workspace({ actualOn: '2026-11-03' })]), []);
  assert.deepEqual(findWorkspaceCapacityWarnings([first, workspace({ tentativeOn: '2026-11-04' })]), []);
});
test('repeated spelling variants of one vehicle produce one warning', () => {
  assert.equal(findWorkspaceCapacityWarnings([workspace({ vehicleIds: ['QA-1', 'qa 1'] }), workspace()]).length, 1);
});
