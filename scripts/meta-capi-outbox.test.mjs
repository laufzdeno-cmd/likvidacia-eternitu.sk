import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const db = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
const transport = readFileSync(new URL('../src/server/meta-conversions-api.ts', import.meta.url), 'utf8');
const cron = readFileSync(new URL('../app/api/cron/meta-capi/route.ts', import.meta.url), 'utf8');

test('Meta CAPI outbox is consent-gated and atomic with the accepted lead transaction', () => {
  assert.match(db, /lead\.rawData\?\.marketingConsentAtSubmit === true[\s\S]*buildMetaCapiOutboxRecord/);
  assert.match(db, /BEGIN[\s\S]*INSERT INTO leads[\s\S]*INSERT INTO lead_meta_capi_outbox[\s\S]*COMMIT/);
  assert.match(db, /event_id text NOT NULL UNIQUE/);
  assert.match(db, /buildMetaCapiOutboxRecord\(lead, input\.submissionId, timestamp\)/);
  assert.match(db, /eventId: conversion\.eventId/);
  assert.match(db, /INSERT INTO lead_meta_capi_consent_subjects[\s\S]*SELECT revoked_at FROM lead_meta_capi_consent_subjects[\s\S]*INSERT INTO leads[\s\S]*INSERT INTO lead_meta_capi_outbox[\s\S]*COMMIT/);
});

test('outbox stores no direct customer or advertising identifiers', () => {
  const schema = db.split('CREATE TABLE IF NOT EXISTS lead_meta_capi_outbox')[1]?.split(');')[0] ?? '';
  for (const forbidden of ['email', 'phone', 'client_ip', 'client_user_agent', 'fbp', 'fbc', 'fbclid', 'gclid']) {
    assert.doesNotMatch(schema, new RegExp(`\\b${forbidden}\\b`, 'i'));
  }
  assert.match(db, /meta_capi_delivery_outbox SET client_ip = NULL, client_user_agent = NULL, fbp = NULL, fbc = NULL/);
});

test('legacy Meta outbox is neutralized and safely migrated without retrying an ambiguous send', () => {
  assert.match(db, /function migrateLegacyMetaCapiOutbox/);
  assert.match(db, /SET client_ip=NULL, client_user_agent=NULL, fbp=NULL, fbc=NULL/);
  assert.match(db, /old\.state IN \('pending','retrying','sending'\)/);
  assert.match(db, /row\.state !== 'sending'.*createAcceptedLeadConversion|createAcceptedLeadConversion[\s\S]*row\.state !== 'sending'/);
  assert.match(db, /legacy_delivery_unknown_no_retry/);
  assert.match(db, /migrated_to_privacy_safe_outbox/);
});

test('claims are bounded, concurrent-safe, reclaim abandoned sends and recheck consent under lock', () => {
  assert.match(db, /FOR UPDATE OF outbox SKIP LOCKED/);
  assert.match(db, /outbox\.status='sending'.*outbox\.claimed_until IS NULL OR outbox\.claimed_until <= \$1/s);
  assert.match(db, /FOR UPDATE OF outbox, leads/);
  assert.match(db, /meta_capi_unknown[\s\S]*claim_expired/);
  assert.match(db, /attempts < outbox\.max_attempts/);
});

test('external delivery runs only after preparation releases the database transaction', () => {
  const prepareStart = db.indexOf('export async function prepareClaimedMetaCapiEvent');
  const settleStart = db.indexOf('export async function settleClaimedMetaCapiEvent');
  const prepare = db.slice(prepareStart, settleStart);
  assert.ok(prepareStart >= 0 && settleStart > prepareStart);
  assert.doesNotMatch(prepare, /sender\s*\(|fetch\s*\(/);
  assert.match(transport, /prepareClaimedMetaCapiEvent\(claim[\s\S]*await sender\(input\)[\s\S]*settleClaimedMetaCapiEvent\(claim/);
});

test('consent revocation and lead deletion remove future delivery capability', () => {
  assert.match(db, /export async function revokeMetaCapiConsentForLead/);
  assert.match(db, /raw_data - 'marketingConsentAtSubmit'/);
  assert.match(db, /- 'fbclid' - 'gclid' - 'gbraid' - 'wbraid'/);
  assert.match(db, /metaCapiOutbox = local\.metaCapiOutbox\.filter\(\(item\) => item\.leadId !== id\)/);
  assert.match(db, /lead_id uuid NOT NULL UNIQUE REFERENCES leads\(id\) ON DELETE CASCADE/);
  assert.match(db, /ON CONFLICT \(consent_subject\) DO UPDATE[\s\S]*marketingConsentSubjectAtSubmit'[\s\S]*FOR UPDATE/);
  assert.match(db, /WHERE raw_data->>'marketingConsentSubjectAtSubmit'=\$1/);
});

test('transport hashes contacts, uses stable event_id and supports injected fetch', () => {
  assert.match(transport, /fetchImpl\?: MetaCapiFetch/);
  assert.match(transport, /event_id: input\.eventId/);
  assert.match(transport, /userData\.em = \[sha256\(email\)\]/);
  assert.match(transport, /userData\.ph = \[sha256\(phone\)\]/);
  assert.match(transport, /status: 'unknown', retryable: true, errorCode: 'transport_unknown'/);
  assert.match(transport, /events_received[\s\S]*body\.events_received > 0/);
  assert.match(transport, /status: 'unknown'.*retryable: true.*errorCode: 'provider_unavailable'/s);
});

test('cron is Node-only, fail-closed on CRON_SECRET and returns generic errors', () => {
  assert.match(cron, /export const runtime = 'nodejs'/);
  assert.match(cron, /process\.env\.CRON_SECRET/);
  assert.match(cron, /timingSafeEqual/);
  assert.match(cron, /META_CAPI_WORKER_FAILED/);
  assert.match(transport, /process\.env\.CONVERSION_EVENT_SECRET/);
  assert.doesNotMatch(cron, /email|phone|fullName|accessToken/);
});
