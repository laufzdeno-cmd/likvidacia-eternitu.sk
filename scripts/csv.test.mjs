import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell } from '../src/server/csv.ts';

test('csvCell neutralizes spreadsheet formulas including leading whitespace', () => {
  for (const value of ['=1+1', '+1+1', '-1+1', '@SUM(A1:A2)', '  =HYPERLINK("https://example.invalid")']) {
    const serialized = csvCell(value);
    assert.match(serialized, /^"?'/, `formula-like value must be prefixed with an apostrophe: ${value}`);
  }
});

test('csvCell preserves ordinary values and escapes CSV delimiters', () => {
  assert.equal(csvCell('ASTANA-20260010'), 'ASTANA-20260010');
  assert.equal(csvCell('Poprad; Slovensko'), '"Poprad; Slovensko"');
  assert.equal(csvCell('text "v úvodzovkách"'), '"text ""v úvodzovkách"""');
  assert.equal(csvCell(123.45), '123.45');
});
