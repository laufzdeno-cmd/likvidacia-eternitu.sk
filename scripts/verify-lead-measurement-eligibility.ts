import assert from 'node:assert/strict';
import { isControlledQaLead, measurementEligibility } from '../src/server/lead-measurement-eligibility';

assert.equal(measurementEligibility({ marketingConsent: true }).conversionEligible, true, 'valid consented lead is eligible');
assert.equal(measurementEligibility({ marketingConsent: false }).conversionEligible, false, 'missing consent is not eligible');
assert.equal(measurementEligibility({ marketingConsent: true, duplicate: true }).conversionEligible, false, 'duplicates are not eligible');
assert.equal(measurementEligibility({ marketingConsent: true, isQa: true }).conversionEligible, false, 'QA leads are not eligible');
assert.equal(measurementEligibility({ marketingConsent: true, isSpam: true }).conversionEligible, false, 'spam leads are not eligible');
assert.equal(isControlledQaLead({ email: 'qa@example.test' }), true, 'example.test is QA');
assert.equal(isControlledQaLead({ fullName: 'QA-PREVIEW-001' }), true, 'explicit QA marker is QA');
assert.equal(isControlledQaLead({ email: 'real@example.sk', fullName: 'Ján Novák' }), false, 'ordinary lead is not QA');

console.log('PASS — lead measurement eligibility is fail-closed for consent, QA, spam, and duplicates.');
