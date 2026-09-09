import assert from 'node:assert/strict';
import { fieldError } from '../app/lead-field-feedback';

const cases: [string, string, boolean][] = [
  ['areaEstimate', '120', true], ['areaEstimate', '0', false], ['areaEstimate', '', false], ['areaEstimate', '100001', false],
  ['city', 'Poprad', true], ['city', 'P', false], ['city', '  ', false],
  ['email', 'qa@example.com', true], ['email', 'neplatny', false], ['email', '', false],
  ['phone', '0905123456', true], ['phone', '', false], ['phone', '123', false], ['phone', 'abcdefgh', false], ['phone', '+421 905 123 456', true],
  ['fullName', 'Test Kontrola', true], ['fullName', 'X', false],
  ['materialType', '', false], ['materialType', 'Vlnitý eternit', true],
  ['objectType', '', false], ['objectType', 'Rodinný dom', true],
  ['gdpr', '', false], ['gdpr', 'on', true], ['district', '', true], ['note', '', true], ['note', 'a'.repeat(3001), false],
];
for (const [field, value, valid] of cases) assert.equal(fieldError(field, value) === null, valid, field);
console.log(`${cases.length} field-validation cases PASS`);
