import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { derivedGoogleAdsOrderIds, formatGoogleAdsOrderId } from '../src/server/google-ads-order-id';

const date = new Date('2026-08-13T10:00:00.000Z');
const first = formatGoogleAdsOrderId('ET', 1842, date);
const second = formatGoogleAdsOrderId('ET', 1843, date);

assert.equal(first, 'AST-ET-260813-001842');
assert.notEqual(first, second);
assert.deepEqual(derivedGoogleAdsOrderIds(first), {
  form: first,
  qualified: `${first}-Q`,
  won: `${first}-W`,
});

const measurementSource = await readFile(new URL('../app/measurement.tsx', import.meta.url), 'utf8');
assert.match(measurementSource, /gtag\?\.\('event', 'conversion'/);
assert.match(measurementSource, /transaction_id: orderId/);
assert.doesNotMatch(measurementSource, /generate_lead', \{[^}]*transaction_id/s);

console.log('Google Ads order ID test: PASS');
