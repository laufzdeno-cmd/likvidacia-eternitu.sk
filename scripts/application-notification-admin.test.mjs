import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const careerPage = readFileSync(new URL('../app/admin/(protected)/kariera/page.tsx', import.meta.url), 'utf8');
const careerDetailPage = readFileSync(new URL('../app/admin/(protected)/kariera/[id]/page.tsx', import.meta.url), 'utf8');
const rooferPage = readFileSync(new URL('../app/admin/(protected)/strechari/page.tsx', import.meta.url), 'utf8');
const statusComponent = readFileSync(new URL('../app/admin/(protected)/notifications/notification-statuses.tsx', import.meta.url), 'utf8');
const action = readFileSync(new URL('../app/admin/(protected)/notifications/actions.ts', import.meta.url), 'utf8');

test('career admin loads persisted statuses and displays both notification recipients', () => {
  assert.match(careerPage, /listApplicationNotificationStatuses\(\s*'career_application'/);
  assert.match(careerPage, /<th>Notifikácie<\/th>/);
  assert.match(careerPage, /<NotificationStatuses\s+entityType="career_application"\s+csrfToken=\{csrfToken\}\s+notifications=\{notificationsByApplication\.get\(application\.id\)/);
});

test('career admin distinguishes an incomplete CV from an application sent without a CV', () => {
  assert.match(careerPage, /<span>Nedokončené vo filtri<\/span><strong>\{counts\.incompleteCv\}<\/strong>/);
  assert.match(careerPage, /application\.cv \? 'priložený' : application\.cvExpected \? 'nahrávanie nedokončené' : 'nepriložený'/);
  assert.match(careerDetailPage, /Uchádzač označil životopis, ale nahrávanie sa nedokončilo\./);
  assert.doesNotMatch(careerPage, /e-mailové notifikácie zatiaľ čakajú|e-maily čakajú/);
});

test('career admin pages filtered applications and reports the filtered count', () => {
  assert.match(careerPage, /countCareerApplications\(filters\)/);
  assert.match(careerPage, /listCareerApplications\(page, PAGE_SIZE, filters\)/);
  assert.match(careerPage, /Strana \{page\} z \{totalPages\} · celkom \{counts\.total\} žiadostí/);
  assert.match(careerPage, /Stránkovanie kariérnych žiadostí/);
});

test('roofer admin loads persisted statuses and displays them in registration details', () => {
  assert.match(rooferPage, /listApplicationNotificationStatuses\('roofer_registration'/);
  assert.match(rooferPage, /<dt>Notifikácie<\/dt>/);
  assert.match(rooferPage, /NotificationStatuses entityType="roofer_registration" csrfToken=\{csrfToken\} notifications=\{notificationsByRegistration\.get\(registration\.id\)/);
});

test('risky states instruct mailbox verification and no resend action or provider details are exposed', () => {
  for (const status of ['pending', 'sending', 'sent', 'failed', 'unknown', 'confirmed_delivered', 'confirmed_not_delivered']) {
    assert.ok(statusComponent.includes(`${status}:`), `missing Slovak label for ${status}`);
  }
  assert.match(statusComponent, /notification\.status === 'unknown'.*notification\.status === 'failed'.*notification\.status === 'pending'/s);
  assert.match(statusComponent, /Overil\(a\) som schránku aj záznam poskytovateľa; tento krok nič neposiela\./);
  assert.match(statusComponent, /name="evidence" required defaultValue=""/);
  assert.match(statusComponent, /value="inbox_message_found"/);
  assert.match(statusComponent, /value="provider_rejected"/);
  assert.doesNotMatch(statusComponent, /textarea name="evidence"/);
  assert.doesNotMatch(statusComponent, /notification\.(?:lastError|messageId)|resend|retryApplicationNotification/i);
});

test('unknown status reconciliation is CSRF-protected, admin-only, stores only an allowlisted evidence code and does not send', () => {
  assert.match(action, /await verifyCsrf\(formData\);\s*const actor = await requireAdmin\(\);/);
  assert.match(action, /checked !== 'yes'/);
  assert.match(action, /isApplicationNotificationEvidenceValid\(resolution, evidence\)/);
  assert.match(action, /resolveUnknownApplicationNotification\(/);
  assert.doesNotMatch(action, /send.*Email|sendMail|processApplicationNotification/i);
  const db = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert.match(db, /isApplicationNotificationEvidenceValid\(input\.resolution, input\.evidence\)/);
  assert.match(db, /evidence,\s*\}\)\]/);
  assert.doesNotMatch(db, /input\.evidence\.trim\(\).*slice\(0, 1000\)/);
});

test('manual resend is audited, gated by provider-confirmed non-delivery and isolated per recipient', () => {
  assert.match(statusComponent, /notification\.status === 'confirmed_not_delivered'/);
  assert.match(statusComponent, /Týmto sa odošle nový email iba vybranému príjemcovi\./);
  assert.match(statusComponent, /Znova odoslať tento email/);
  assert.doesNotMatch(statusComponent, /Znova odoslať oba emaily|careerPair|Kariérny relay/);
  assert.match(action, /checked !== 'yes'/);
  assert.match(action, /prepareConfirmedApplicationNotificationRetry\(/);
  assert.match(action, /processCareerApplicationNotification\(entityId, recipient as ApplicationNotificationRecipient\)/);
  assert.match(action, /processRooferRegistrationNotification\(entityId, recipient/);
});
