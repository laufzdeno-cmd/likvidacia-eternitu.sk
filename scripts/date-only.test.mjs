import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidIsoCalendarDate } from '../src/lib/date-only.ts';

test('ISO dátum odmieta neexistujúce dni a rešpektuje priestupný rok', () => {
  for (const value of ['2027-02-31', '2026-13-01', '2027-02-29']) {
    assert.equal(isValidIsoCalendarDate(value), false, value);
  }
  assert.equal(isValidIsoCalendarDate('2028-02-29'), true);
});
