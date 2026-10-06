import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const route = read('../app/api/analytics/route.ts');
const tracker = read('../src/lib/analytics-client.ts');
const attributionClient = read('../src/lib/analytics-attribution-client.ts');
const analyticsEngine = read('../src/lib/analytics-event-engine.ts');
const consent = read('../src/lib/marketing-consent.ts');
const widgets = read('../app/public-widgets.tsx');
const publicLayout = read('../app/public-layout.tsx');
const cookies = read('../app/cookies/page.tsx');
const privacy = read('../app/ochrana-osobnych-udajov/page.tsx');
const lead = read('../app/api/lead/route.ts');
const db = read('../src/server/db.ts');
const analyticsRecovery = read('../src/server/analytics-recovery.ts');
const emailCron = read('../app/api/cron/notifications/route.ts');
const critical = read('../app/homepage-critical-client.tsx');
const landing = read('../app/landing-client.tsx');
const publicBase = read('../app/public-base-client.tsx');
const adConversion = read('../src/lib/ad-conversion-tracking.mjs');
const adConversionEngine = read('../src/lib/ad-conversion-engine.mjs');
const adConversionTests = read('../scripts/ad-conversion-tracking.test.mjs');

test('analytics API is gated by the server-readable consent cookie before persistence', () => {
  assert.match(route, /request\.cookies\.get\(analyticsConsentCookieName\)\?\.value !== 'granted'/);
  assert.match(route, /ok: true, skipped: true/);
  assert.ok(route.indexOf('skipped: true') < route.indexOf('recordAnalyticsEvent({'));
  assert.match(route, /request\.cookies\.get\(marketingConsentCookieName\)\?\.value !== 'granted'[\s\S]{0,80}delete metadata\.adClickIds/);
});

test('all public analytics events share a tracker that is inert without consent', () => {
  for (const client of [critical, landing, publicBase]) {
    assert.match(client, /from ['"]@\/src\/lib\/analytics-client['"]/);
    assert.doesNotMatch(client, /localStorage\.setItem\(['"]astana_analytics_session/);
  }
  assert.match(tracker, /import\('\.\/analytics-event-engine'\)/,
    'the event transport stays behind the public dynamic facade');
  assert.match(tracker, /if \(!hasConsent\(\)\) return/);
  assert.match(attributionClient, /window\.sessionStorage\.setItem\(sessionStorageKey/);
  assert.match(attributionClient, /hasMarketingConsent\(\)/);
  assert.match(analyticsEngine, /if \(!hasAnalyticsConsent\(\)\) return/);
  assert.match(analyticsEngine, /adClickIds/);
  assert.match(publicBase, /document\.addEventListener\('click', preserveCampaignAttributionOnInternalLink, true\)/);
  assert.match(publicBase, /document\.removeEventListener\('click', preserveCampaignAttributionOnInternalLink, true\)/,
    'campaign forwarding is removed with the public client listener');
  assert.match(landing, /document\.addEventListener\('click', preserveCampaignAttributionOnInternalLink, true\)/,
    'full landing client forwards consented campaign parameters on internal navigation');
  assert.match(landing, /document\.removeEventListener\('click', preserveCampaignAttributionOnInternalLink, true\)/,
    'full landing client cleans up campaign forwarding on unmount');
});

test('consent stores separate categories and removes analytics identifiers on denial', () => {
  assert.match(consent, /analyticsConsentCookieName/);
  assert.match(consent, /marketingConsentCookieName/);
  assert.match(consent, /Max-Age=\$\{consentMaxAge\}/);
  assert.match(consent, /if \(!normalized\.analytics\)[\s\S]{0,500}analyticsSessionStorageKey/);
  assert.match(consent, /if \(!normalized\.marketing\)[\s\S]{0,700}delete attribution\.gclid[\s\S]{0,100}delete attribution\.fbclid[\s\S]{0,100}delete attribution\.gbraid[\s\S]{0,100}delete attribution\.wbraid/);
  assert.match(consent, /function removeSessionItem\(key: string\)[\s\S]{0,180}catch[\s\S]{0,100}Storage may be disabled/);
  assert.match(consent, /catch \{\s*removeSessionItem\(analyticsAttributionStorageKey\);\s*\}/);
  assert.doesNotMatch(consent, /pendingMetaLeadStorageKey|rememberPendingMetaLead|takePendingMetaLead/);
  assert.match(widgets, /Prijať všetky/);
  assert.match(widgets, /Uložiť výber/);
  assert.match(widgets, /Len nevyhnutné/);
  assert.match(widgets, /Analytika/);
  assert.match(widgets, /Marketingové meranie/);
  assert.match(widgets, /cookie-banner-expanded/);
  assert.match(widgets, /aria-controls="cookie-preferences"/);
  assert.match(widgets, /Upraviť výber/);
  assert.match(widgets, /cookie-save/);
  const firstChoice = widgets.indexOf('>Prijať všetky</button>');
  const refusal = widgets.indexOf('>Len nevyhnutné</button>');
  const details = widgets.indexOf('>Upraviť výber</button>');
  assert.ok(firstChoice >= 0 && refusal > firstChoice && details > refusal,
    'mobile consent tab order must present acceptance and refusal before customization');
  assert.match(widgets, /if \(showCookieBanner && showCookiePreferences\) analyticsCheckboxRef\.current\?\.focus\(\)/,
    'opening category choices must move keyboard focus off the hidden customize button');
  assert.match(widgets, /ref=\{analyticsCheckboxRef\} type="checkbox"/);
  assert.match(widgets, /attachAcceptedLeadConversionTracking/);
  assert.match(widgets, /Po úspešnom dopyte môžeme Google Ads a Meta/);
  assert.match(adConversion, /import\('\.\/ad-conversion-engine\.mjs'\)/,
    'provider code stays behind the public dynamic facade');
  assert.match(adConversion, /maximumQueuedEvents/);
  assert.match(adConversionEngine, /if \(!hasMarketingConsent\(\)\) return/);
  assert.match(adConversionEngine, /ad_user_data: 'denied'/);
  assert.match(adConversionEngine, /allow_enhanced_conversions: false/);
  assert.match(adConversionEngine, /event', 'conversion'/);
  assert.match(adConversionEngine, /'track', 'Lead'/);
  assert.match(adConversionEngine, /autoConfig', false/);
  assert.match(cookies, /Pri súhlase s marketingovým meraním sa reklamné značky Google Ads alebo Meta načítajú počas návštevy stránky/);
  assert.match(cookies, /Samotnú konverznú udalosť odošleme až po potvrdenom odoslaní dopytu/);
  assert.match(cookies, /neposielame meno, telefón, email, poznámku ani fotografie/);
  assert.match(adConversionTests, /marketing consent loads tags on the landing page, but only an accepted lead sends a conversion/);
  assert.match(adConversionTests, /granting consent does not send a lead conversion/);
});

test('cookie settings can be reopened and policy no longer calls analytics anonymous', () => {
  assert.match(cookies, /id="nastavenia"/);
  assert.match(cookies, /CookieSettingsTrigger/);
  assert.match(privacy, /Tieto údaje nie sú anonymné/);
  assert.doesNotMatch(privacy, /anonymn.{0,30}analytik/i);
});

test('public cookie widget does not pull the admin-aware router into every public page', () => {
  assert.doesNotMatch(widgets, /usePathname|next\/navigation|isAdmin/);
  assert.match(publicLayout, /<PublicWidgets hideWhatsappOnMobile=\{hideWhatsappOnMobile\} \/>/);
});

test('cookie refusal does not block quote submission; it only omits optional lead attribution', () => {
  assert.match(lead, /const leadAttribution = parseLeadAttribution\(/);
  assert.match(lead, /\.\.\.\(leadAttribution \? \{ attribution: leadAttribution \} : \{\}\)/);
  assert.doesNotMatch(lead, /if \(!leadAttribution\) return/);
});

test('accepted lead conversion is server-recorded from the stored lead, not forgeable through public analytics', () => {
  assert.doesNotMatch(route, /'form_submit_success'/);
  assert.match(lead, /recordAcceptedLeadAnalytics\(submission\.lead\)/);
  assert.match(lead, /recordAcceptedLeadAnalytics\(existing\.lead\)/);
  assert.match(lead, /analyticsConsentAtSubmit: true, analyticsSessionId/);
  assert.match(lead, /analyticsConsentAtSubmit\s*\?\s*\([\s\S]{0,260}randomUUID\(\)/);
  assert.match(db, /dedupeId: lead\.id/);
  assert.match(db, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(db, /acceptedLeadEvents[\s\S]{0,400}otherEvents/);
  assert.match(db, /const device = \/iPad\|Tablet/);
  assert.match(db, /localDbWriteQueue\.then\(persist, persist\)/);
  assert.match(db, /existingAnalytics, \.\.\.data\.analyticsEvents/);
  assert.match(db, /export async function recoverAcceptedLeadAnalytics/);
  assert.match(db, /createdAt: lead\.createdAt/);
  assert.match(db, /boundedLimit \+ 1/);
  assert.match(db, /persistAcceptedLeadAnalyticsBatch\(/);
  assert.match(analyticsRecovery, /for \(const record of records\)[\s\S]*?try \{[\s\S]*?catch \(error\)/);
  assert.match(analyticsRecovery, /if \(await persist\(record\)\) recovered \+= 1/);
  assert.match(analyticsRecovery, /onError\?\.\(record, error\)/);
  assert.match(db, /let unrecoverable = 0/);
  assert.match(db, /LEFT JOIN analytics_events e ON e\.id = l\.id/);
  assert.match(emailCron, /recoverAcceptedLeadAnalytics\(\)/);
  assert.match(db, /analyticsConsentAtSubmit !== true/);
  for (const client of [critical, landing]) {
    assert.doesNotMatch(client, /trackAnalytics\(['"]form_submit_success['"]/);
    assert.match(client, /getAnalyticsSessionId\(\)/);
  }
});
