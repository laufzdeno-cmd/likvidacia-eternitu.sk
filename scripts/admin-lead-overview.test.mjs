import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  leadFollowupPresentation,
  leadOfferFilterMatches,
  leadOfferPresentation,
} from '../src/lib/admin-lead-overview.ts';

test('cenové ponuky majú jednoznačné obchodné stavy', () => {
  assert.deepEqual(leadOfferPresentation(undefined), {
    state: 'none',
    label: 'Bez CP',
    detail: 'Treba vytvoriť cenovú ponuku',
  });
  assert.equal(leadOfferPresentation('PRIPRAVENA').state, 'prepared');
  assert.equal(leadOfferPresentation('ODOSLANA').state, 'waiting');
  assert.equal(leadOfferPresentation('PRIJATA').state, 'accepted');
  assert.equal(leadOfferPresentation('NEISTY_STAV').state, 'attention');
  assert.equal(leadOfferPresentation('ZRUSENA').state, 'cancelled');
});

test('filter cenových ponúk zoskupuje stavy podľa práce, ktorú treba urobiť', () => {
  assert.equal(leadOfferFilterMatches(undefined, 'none'), true);
  assert.equal(leadOfferFilterMatches('PRIPRAVENA', 'prepared'), true);
  assert.equal(leadOfferFilterMatches('ODOSLANA', 'waiting'), true);
  assert.equal(leadOfferFilterMatches('PRIJATA', 'accepted'), true);
  assert.equal(leadOfferFilterMatches('ODOSIELA', 'attention'), true);
  assert.equal(leadOfferFilterMatches('NEISTY_STAV', 'attention'), true);
  assert.equal(leadOfferFilterMatches('ZRUSENA', 'waiting'), false);
});

test('termín kontaktovania zreteľne odlišuje omeškanie, dnešok a budúcnosť', () => {
  assert.equal(leadFollowupPresentation('2026-10-11', '2026-10-12')?.tone, 'danger');
  assert.deepEqual(leadFollowupPresentation('2026-10-12', '2026-10-12'), {
    tone: 'warning',
    label: 'Kontaktovať dnes',
  });
  assert.equal(leadFollowupPresentation('2026-10-13', '2026-10-12')?.tone, 'neutral');
  assert.equal(leadFollowupPresentation(undefined, '2026-10-12'), null);
});

test('odstránenie testu je superadmin operácia a zostáva obnoviteľnou archiváciou', async () => {
  const [page, actions, styles, database] = await Promise.all([
    readFile(new URL('../app/admin/(protected)/dopyty/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/dopyty/[id]/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/admin-route.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /adminUser\.role === 'SUPER_ADMIN' && lead\.isTestData/);
  assert.match(page, /const today = businessTodayKey\(\)/);
  assert.doesNotMatch(page, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(page, /Odstrániť test/);
  assert.match(actions, /archiveTestLeadFromListAction[\s\S]*requireSuperAdmin/);
  assert.match(actions, /if \(!lead\.isTestData\)[\s\S]*archiveLeadRecord/);
  const quickArchiveAction = actions.slice(
    actions.indexOf('export async function archiveTestLeadFromListAction'),
    actions.indexOf('export async function deleteLeadFileAction'),
  );
  assert.doesNotMatch(quickArchiveAction, /destroyArchivedLead\(/);
  assert.match(styles, /\.admin-offer-state\.is-prepared/);
  assert.match(styles, /\.admin-leads-table \.admin-row-link/);
  assert.match(database, /LEFT JOIN LATERAL \([\s\S]*FROM price_offers/);
});
