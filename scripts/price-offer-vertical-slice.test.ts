import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { calculatePriceOfferPricing } = require('../src/lib/price-offer-pricing.ts');
const { roundTripDistanceKm } = require('../src/lib/price-offer-distance.ts');
const { resolvePriceOfferVatRate } = require('../src/lib/price-offer-vat.ts');
const { priceOfferUpdateLifecycle } = require('../src/lib/price-offer-state.ts');
const { slovakCalendarDateAfterDays } = require('../src/lib/date-only.ts');
const { renderPriceOfferPdfHtml } = require('../src/server/price-offer-pdf.ts');
const { priceOfferEmailHtml, priceOfferEmailText } = require('../src/server/mail.ts');

const base = {
  id: 'offer-test', number: '20260001', jobId: '', createdAt: '2026-10-05T08:00:00.000Z', validUntil: '2026-12-04',
  objectType: 'Hospodárska budova', objectAddress: 'Poprad', municipality: 'Poprad', district: 'Popradský',
  contactPerson: 'Test Klient', phone: '0905123456', email: 'test@example.com', realizationTerm: 'Dohodou',
  materialType: 'AZBESTOVE_RURY', areaM2: 100, pricePerM2WithoutVat: 10.5, documentationFeeWithoutVat: 161,
  includeDocumentation: true, documentationPromotion: false, includeTransport: false, transportFrom: 'Poprad',
  transportTo: 'Bratislava', transportRoundTripKm: 0, transportPricePerKm: 0.7, offerNote: '', internalNote: '',
  sourceInquiry: 'dopyt:00000000-0000-4000-8000-000000000001', vatRate: 23, materialPriceWithoutVat: 1050,
  totalWithoutVat: 1211, totalWithVat: 1489.53, status: 'PRIPRAVENA',
};
const settings = { vatRate: 23, preparedByName: 'ASTANA', preparedByPhone: '0918518277', company: {
  name: 'ASTANA, s.r.o.', street: 'Scherffelova 1364/28', city: 'Poprad', postalCode: '05801', phone: '0905217946',
  email: 'astana@astana.sk', mainWeb: 'astana.sk', asbestosWeb: 'likvidacia-eternitu.sk', ico: '46157701', dic: '',
  icDph: '', authorization: '', preparedByName: 'ASTANA', preparedByPhone: '0918518277', vatRate: 23,
} };

test('výpočet zachová cenu a promo dokumentáciu zmení na 0 €', () => {
  assert.equal(calculatePriceOfferPricing(base, 23).totalWithVat, 1489.53);
  assert.equal(calculatePriceOfferPricing({ ...base, documentationPromotion: true }, 23).documentationWithoutVat, 0);
});

test('doprava používa spiatočné kilometre a editovateľnú sadzbu', () => {
  const totals = calculatePriceOfferPricing({ ...base, includeTransport: true, transportRoundTripKm: 123.45, transportPricePerKm: 0.8 }, 23);
  assert.equal(totals.transportWithoutVat, 98.76);
  assert.equal(totals.totalWithVat, 1611);
  assert.equal(roundTripDistanceKm(42_300), 84.6);
  assert.equal(roundTripDistanceKm(2_000_001), null);
});

test('platnosť ponuky sa počíta zo slovenského kalendárneho dňa aj okolo polnoci a zmeny času', () => {
  assert.equal(slovakCalendarDateAfterDays(60, new Date('2026-01-15T23:30:00.000Z')), '2026-03-17');
  assert.equal(slovakCalendarDateAfterDays(60, new Date('2026-06-15T22:30:00.000Z')), '2026-08-15');
  assert.equal(slovakCalendarDateAfterDays(0, new Date('2026-03-29T00:30:00.000Z')), '2026-03-29');
  assert.equal(slovakCalendarDateAfterDays(0, new Date('2026-10-25T00:30:00.000Z')), '2026-10-25');
});

test('stará URL cenovej ponuky iba presmeruje do schváleného workflow', async () => {
  const legacyPage = await readFile(new URL('../app/admin/(protected)/dopyty/[id]/cenova-ponuka/page.tsx', import.meta.url), 'utf8');
  assert.match(legacyPage, /redirect\(`\/admin\/ponuky\/nova\?lead=\$\{encodeURIComponent\(id\)\}`\)/);
  assert.doesNotMatch(legacyPage, /createQuoteAction|createQuote|<form/);
});

test('historická DPH sa bezpečne odvodí a null nikdy neznamená 0 %', () => {
  assert.equal(resolvePriceOfferVatRate({ totalWithoutVat: 1211, totalWithVat: 1453.2 }, 23), 20);
  assert.equal(resolvePriceOfferVatRate({ vatRate: null, totalWithoutVat: 0, totalWithVat: 0 }, 23), 23);
  assert.equal(resolvePriceOfferVatRate({ vatRate: '23.00', totalWithoutVat: 10.5, totalWithVat: 12.92 }, 20), 23);
  assert.equal(resolvePriceOfferVatRate({ vatRate: 'invalid', totalWithoutVat: 10.5, totalWithVat: 12.92 }, 20), 23.05);
});

test('odoslaná aj prijatá ponuka zostávajú nemenným obchodným dokladom', () => {
  assert.deepEqual(priceOfferUpdateLifecycle({ status: 'ODOSLANA', sentAt: '2026-10-04T12:00:00Z' }), {
    allowed: false, status: 'ODOSLANA', sentAt: '2026-10-04T12:00:00Z', requiresResend: false,
  });
  assert.equal(priceOfferUpdateLifecycle({ status: 'PRIJATA' }).allowed, false);
  assert.equal(priceOfferUpdateLifecycle({ status: 'ODOSIELA' }).allowed, false);
  assert.equal(priceOfferUpdateLifecycle({ status: 'NEISTY_STAV' }).allowed, false);
});

test('PDF jasne označuje ASTANA s.r.o., materiál, objekt, dopravu a bezplatné dokumenty', () => {
  const offer = { ...base, documentationPromotion: true, includeTransport: true, transportRoundTripKm: 123.45, transportPricePerKm: 0.8 };
  Object.assign(offer, calculatePriceOfferPricing(offer, 23));
  const html = renderPriceOfferPdfHtml(offer, settings);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /ASTANA, s\.r\.o\./);
  assert.match(html, /--burgundy: #8F163C/);
  assert.match(html, /border-bottom: 3px solid var\(--burgundy\)/);
  assert.match(html, /Vo verejnom zozname ÚVZ SR zverejnenom k 19\. 9\. 2024/);
  assert.doesNotMatch(html, /má oprávnenie na likvidáciu a manipuláciu/);
  assert.match(html, /Azbestové rúry/);
  assert.match(html, /Hospodárska budova/);
  assert.match(html, /Dokumentácia — AKCIA 0,00 €/);
  assert.match(html, /123,45 km × 0,80 €/);
  assert.match(html, /nejde o žiadosť o povolenie/);
  assert.match(html, /po dokončení zákazky/);
});

test('PDF pri hranične dlhých údajoch zachová dve pevné A4 strany a presunie dlhú poznámku', () => {
  const longOffer = {
    ...base,
    objectType: 'Hospodárska budova '.repeat(7),
    objectAddress: 'Veľmi dlhá skúšobná adresa '.repeat(9),
    municipality: 'Banská Bystrica '.repeat(7),
    district: 'Banskobystrický okres '.repeat(6),
    contactPerson: 'Ing. Alexandra Katarína Veľmi-Dlhé-Priezvisko '.repeat(4),
    realizationTerm: 'Po dohode v nadväznosti na pripravenosť strechárov '.repeat(5),
    includeTransport: true,
    transportFrom: 'Poprad Scherffelova 1364/28 '.repeat(9),
    transportTo: 'Bratislava cieľová adresa '.repeat(10),
    offerNote: 'TEST - NEKONTAKTOVAŤ. Dlhá poznámka pre tlačový test. '.repeat(9).slice(0, 500),
  };
  const html = renderPriceOfferPdfHtml(longOffer, settings);
  assert.match(html, /@page \{ size: A4; margin: 0; \}/);
  assert.match(html, /height: 297mm; min-height: 297mm/);
  assert.match(html, /<section class="page page--compact">/);
  assert.match(html, /<section class="page page--terms-note">/);
  assert.equal((html.match(/Poznámka k cenovej ponuke/g) || []).length, 1);
  assert.equal((html.match(/TEST - NEKONTAKTOVAŤ/g) || []).length, 9);
});

test('zákaznícky email používa dynamický opis a nezahŕňa nekúpenú dokumentáciu', () => {
  const offer = { ...base, includeDocumentation: false, includeTransport: false };
  const html = priceOfferEmailHtml(offer, settings);
  const text = priceOfferEmailText(offer, settings);
  assert.match(html, /astana-logo-dark\.png/);
  assert.match(html, /ASTANA, s\.r\.o\./);
  assert.match(html, /na objekte typu Hospodárska budova/);
  assert.match(text, /materiál Azbestové rúry na objekte typu Hospodárska budova/);
  assert.match(html, /Dobrý deň,<\/p>/);
  assert.match(html, /bgcolor="#A94722"/);
  assert.match(html, /background:#A94722;background-image:linear-gradient/);
  assert.doesNotMatch(html, /p\.\/pani/);
  assert.match(text, /^Dobrý deň,/);
  assert.match(html, /záväznú objednávku odpoveďou na tento email/);
  assert.match(html, /číslo cenovej ponuky <strong>20260001<\/strong>/);
  assert.match(html, /ulicu, číslo a prípadne parcelu/);
  assert.match(html, /objednávateľa a jeho úplnú adresu/);
  assert.match(html, /vlastníka objektu typu Hospodárska budova/);
  assert.match(text, /1\. číslo cenovej ponuky 20260001/);
  assert.match(text, /2\. presnú adresu objektu typu Hospodárska budova/);
  assert.match(text, /Po ukončení prác vám podľa rozsahu zákazky odovzdáme dostupné doklady/);
  assert.match(text, /dokladu o preprave alebo prevzatí odpadu, ak bol vystavený/);
  assert.match(text, /doklad o hmotnosti odpadu, ak bol vystavený/);
  assert.match(text, /potvrdenie o zneškodnení azbestu firmou ASTANA, s\.r\.o\./);
  assert.doesNotMatch(text, /Potvrdenie RÚVZ medzi záverečnými dokladmi/);
  assert.doesNotMatch(`${html}\n${text}`, /Dokumentácia a súvisiace podklady|Správne poplatky na úradoch/);
});

test('DB schema má aditívne defaulty pre historické ponuky a zamyká súbežnú úpravu prijatej CP', async () => {
  const db = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert.match(db, /ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS transport_price_per_km numeric\(12,2\) NOT NULL DEFAULT 0\.70/);
  assert.match(db, /ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS documentation_promotion boolean NOT NULL DEFAULT false/);
  assert.match(db, /ALTER TABLE price_offers ADD COLUMN IF NOT EXISTS send_started_at timestamptz/);
  assert.match(db, /WHERE price_offers\.status NOT IN \('PRIJATA', 'ODOSLANA', 'ODOSIELA', 'NEISTY_STAV'\)\s+RETURNING id/);
  assert.match(db, /status = 'ODOSIELA', send_started_at = \$2[\s\S]*?status = 'PRIPRAVENA' RETURNING \*/);
  assert.match(db, /status IN \('NEISTY_STAV', 'ODOSIELA'\)[\s\S]*?interval '15 minutes'/);
  assert.match(db, /SELECT pg_advisory_xact_lock\(hashtext\(\$1\)\)[\s\S]*?price-offer-number:/);
  assert.match(db, /client\.query\('BEGIN'\)[\s\S]*?INSERT INTO price_offers[\s\S]*?INSERT INTO audit_logs[\s\S]*?client\.query\('COMMIT'\)/);
});

test('odoslanie CP používa atomický claim a pri neistom SMTP stave blokuje opakovanie', async () => {
  const actions = await readFile(new URL('../app/admin/(protected)/ponuky/actions.ts', import.meta.url), 'utf8');
  const list = await readFile(new URL('../app/admin/(protected)/ponuky/page.tsx', import.meta.url), 'utf8');
  const detail = await readFile(new URL('../app/admin/(protected)/ponuky/[id]/page.tsx', import.meta.url), 'utf8');
  const mail = await readFile(new URL('../src/server/mail.ts', import.meta.url), 'utf8');
  assert.match(actions, /current\.status !== 'PRIPRAVENA'/);
  assert.match(actions, /claimPriceOfferForSending\(id, actor\)/);
  assert.match(actions, /finishPriceOfferSending\(id, sendAttemptId, result\.status, actor\)/);
  assert.match(actions, /if \(result\.status === 'sent'\) \{[\s\S]*?sent = true;[\s\S]*?\} else \{[\s\S]*?sendError = result\.status === 'unknown'/);
  assert.doesNotMatch(actions, /result\.status !== 'not_sent'/);
  assert.doesNotMatch(actions, /price_offer_email_sent|price_offer_email_error/);
  assert.match(actions, /let deliveryReason = ''/);
  assert.match(actions, /const persisted = finalized \|\| await getPriceOffer\(id\)/);
  assert.match(actions, /\['ODOSLANA', 'PRIJATA'\]\.includes\(persisted\.status\)/);
  assert.match(actions, /persisted\?\.status === 'NEISTY_STAV'/);
  assert.match(actions, /persisted\?\.status === 'PRIPRAVENA'/);
  assert.match(actions, /expectedStatePersisted && outcome === 'sent'[\s\S]*?sent = true;[\s\S]*?sendError = ''/);
  assert.match(actions, /confirmedNotSent.*!== 'yes'/);
  assert.doesNotMatch(list, /sendPriceOfferAction|>Odoslať<\/button>/);
  assert.match(list, /href=\{`\/admin\/ponuky\/\$\{offer\.id\}`\}>Otvoriť CP<\/a>/);
  assert.match(detail, /offer\.status === 'PRIPRAVENA'.*Odoslať zákazníkovi/);
  assert.match(detail, /skontrolovali odoslanú poštu/);
  assert.match(mail, /status === 'failed' \? 'not_sent' as const : 'unknown' as const/);
  assert.match(mail, /const requiredRecipient = resolveOutboundEmailRecipient\(offer\.email\)/);
  assert.match(mail, /classifyRequiredSmtpRecipient\(info, requiredRecipient\)/);
  assert.match(mail, /Interná kópia nemení stav ponuky na odoslanú/);
  assert.match(list, /offer\.status === 'ODOSLANA'.*updatePriceOfferStatusAction/);
  assert.match(actions, /if \(!updated\) throw new Error\('Ako prijatú možno označiť iba odoslanú/);
  const db = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert.match(db, /item\.status === 'ODOSLANA'/);
  assert.match(db, /deleted_at IS NULL AND status = 'ODOSLANA' RETURNING \*/);
  assert.match(db, /send_attempt_id = \$5/);
  assert.match(db, /offer\.sendAttemptId !== attemptId/);
  assert.match(db, /withLocalLeadSubmissionLock[\s\S]*?price_offer_status_changed[\s\S]*?writeLocalDb\(local\)/);
  assert.match(db, /client\.query\('BEGIN'\)[\s\S]*?price_offer_status_changed[\s\S]*?client\.query\('COMMIT'\)/);
  assert.doesNotMatch(actions, /email:\s*offer\.email/);
  assert.match(actions, /confirmUncertainPriceOfferSentAction/);
  assert.match(actions, /uncertainSendEvidenceCodes\.has\(reason\)/);
  assert.match(actions, /confirmUncertainPriceOfferSent\(id, actor, reason\)/);
  assert.match(actions, /revalidatePath\('\/admin\/dopyty'\)/);
  assert.match(actions, /revalidatePath\('\/admin\/zakazky'\)/);
});

test('neisté odoslanie možno manuálne potvrdiť iba s dôkazom a bez nového emailu', async () => {
  const detail = await readFile(new URL('../app/admin/(protected)/ponuky/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(detail, /canConfirmUncertainSend\(offer\)[\s\S]*?confirmationEvidence/);
  assert.match(detail, /offer\.status === 'ODOSIELA'[\s\S]*?canResetUncertainSend\(offer\)/);
  assert.match(detail, /sent_folder_verified/);
  assert.match(detail, /recipient_confirmed/);
  assert.match(detail, /provider_confirmed/);
  assert.match(detail, /Potvrdzujem, že ponuka bola odoslaná a nemá sa posielať znova/);
  assert.doesNotMatch(detail, /confirmUncertainPriceOfferSentAction[\s\S]*?sendPriceOfferDocumentEmail/);
});

test('detail zákazky vedie iba do schváleného PDF toku cenovej ponuky', async () => {
  const detail = await readFile(new URL('../app/admin/(protected)/zakazky/[id]/page.tsx', import.meta.url), 'utf8');
  const jobActions = await readFile(new URL('../app/admin/(protected)/zakazky/actions.ts', import.meta.url), 'utf8');
  const mail = await readFile(new URL('../src/server/mail.ts', import.meta.url), 'utf8');
  const db = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');

  assert.match(detail, /href=\{`\/admin\/ponuky\/nova\?zakazka=\$\{job\.id\}`\}>\+ Vytvoriť cenovú ponuku<\/a>/);
  assert.doesNotMatch(detail, /sendBusinessQuoteAction|Odoslať cenovú ponuku zákazníkovi/);
  assert.doesNotMatch(jobActions, /sendBusinessQuoteAction|sendBusinessQuoteEmail|markBusinessJobQuoteSent/);
  assert.doesNotMatch(mail, /sendBusinessQuoteEmail/);
  assert.doesNotMatch(db, /export async function markBusinessJobQuoteSent/);
});

test('dopyty zobrazujú poslednú ponuku cez jeden dávkový, archivované ponuky ignorujúci lookup', async () => {
  const db = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  const page = await readFile(new URL('../app/admin/(protected)/dopyty/page.tsx', import.meta.url), 'utf8');
  assert.match(db, /getLatestPriceOffersByInquiryIds\(inquiryIds: string\[\]\)/);
  assert.match(db, /DISTINCT ON \(lead_id\)[\s\S]*?deleted_at IS NULL[\s\S]*?created_at DESC, number DESC/);
  assert.match(page, /getLatestPriceOffersByInquiryIds\(leadPage\.items\.map\(\(lead\) => lead\.id\)\)/);
  assert.match(page, /Pripravená · neodoslaná/);
  assert.match(page, /Odoslaná/);
  assert.match(page, /Bez ponuky/);
  assert.match(page, /const offer = latestOffers\.get\(lead\.id\);[\s\S]*?href=\{`\/admin\/ponuky\/\$\{offer\.id\}`\}>Otvoriť CP<\/a>[\s\S]*?: <a className="admin-row-link is-plum" href=\{`\/admin\/ponuky\/nova\?lead=\$\{lead\.id\}`\}>Vytvoriť CP<\/a>/);
});

test('detail dopytu zobrazuje novú cenovú ponuku a jej stav', async () => {
  const page = await readFile(new URL('../app/admin/(protected)/dopyty/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /getLatestPriceOffersByInquiryIds\(\[lead\.id\]\)/);
  assert.match(page, /latestPriceOffer\.status === 'PRIPRAVENA'[\s\S]*?Pripravená · neodoslaná/);
  assert.match(page, /latestPriceOffer\.status === 'ODOSLANA'[\s\S]*?Odoslaná/);
  assert.match(page, /!lead\.quotes\.length && !latestPriceOffer/);
});

test('server action validuje cenu a Maps ostáva serverové s ručným fallbackom', async () => {
  const actions = await readFile(new URL('../app/admin/(protected)/ponuky/actions.ts', import.meta.url), 'utf8');
  const form = await readFile(new URL('../app/admin/(protected)/ponuky/offer-form.tsx', import.meta.url), 'utf8');
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(actions, /await verifyCsrf\(formData\);\s*await requireAdmin\(\);/);
  assert.match(actions, /process\.env\.GOOGLE_MAPS_API_KEY/);
  assert.match(actions, /input\.includeTransport && \(!input\.transportFrom \|\| !input\.transportTo \|\| input\.transportRoundTripKm <= 0\)/);
  assert.match(actions, /input\.realizationTerm\.length > 250/);
  assert.match(actions, /allowedMaterialTypes\.has\(input\.materialType\)/);
  assert.match(actions, /isSingleEmailAddress\(input\.email\)/);
  assert.match(actions, /isUsablePhone\(input\.phone\)/);
  assert.match(actions, /isValidIsoCalendarDate\(input\.validUntil\)/);
  assert.match(actions, /input\.validUntil < todayInSlovakia\(\)/);
  assert.match(actions, /Cenovú ponuku sa nepodarilo odoslať\./);
  assert.match(form, /Cena za km bez DPH/);
  assert.match(form, /Vzdialenosť a sadzbu môžete upraviť ručne/);
  assert.match(form, /name="realizationTerm" maxLength=\{250\}/);
  assert.match(form, /dohodou – po splnení potrebného postupu pred prácami/);
  assert.doesNotMatch(form, /po vydaní rozhodnutí z úradov/);
  assert.match(form, /const vatRate = offer\?\.vatRate \?\? settings\.vatRate/);
  assert.match(form, /const requestId = \+\+routeRequestId\.current/);
  assert.match(form, /requestId !== routeRequestId\.current/);
  assert.match(form, /routeRequestId\.current \+= 1; setTransportFrom/);
  assert.match(form, /routeRequestId\.current \+= 1; setTransportTo/);
  assert.match(form, /routeRequestId\.current \+= 1; setTransportRoundTripKm/);
  assert.match(form, /Uložiť a skontrolovať odoslanie/);
  assert.doesNotMatch(form, /GOOGLE_MAPS_API_KEY|routes\.googleapis\.com/);
  assert.match(envExample, /^GOOGLE_MAPS_API_KEY=$/m);
  assert.match(envExample, /Iba serverový kľúč Google Routes API/);
  assert.match(envExample, /Bez neho ostáva doprava plne funkčná s ručne editovateľnými kilometrami/);
});

test('detail dopytu ponúka stav Nacenený a odoslaná CP je iba na čítanie', async () => {
  const leadDetail = await readFile(new URL('../app/admin/(protected)/dopyty/[id]/page.tsx', import.meta.url), 'utf8');
  const offerDetail = await readFile(new URL('../app/admin/(protected)/ponuky/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(leadDetail, /'kontaktovany',\s*'naceneny',\s*'cenova_ponuka_odoslana'/);
  assert.match(offerDetail, /offer\.status === 'PRIPRAVENA' \? <form/);
  assert.match(offerDetail, /Odoslaná verzia je uzamknutá/);
});
