import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('case drafts require audited super-admin review before any public access', async () => {
  const [db, page, actions, nav, publicPage, gallery, sitemap, visualStyles, mediaRoute, photoPage, photoActions, jobActions, leadActions] = await Promise.all([
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/pripady/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/pripady/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/admin-nav.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/realizacie/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/admin-route.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/realization-case-media/[id]/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/fotky/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/fotky/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/zakazky/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/dopyty/[id]/actions.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(db, /CREATE TABLE IF NOT EXISTS realization_case_drafts/);
  assert.match(db, /lifecycle IN \('draft', 'reviewed', 'approved', 'published', 'withdrawn'\)/);
  assert.match(db, /m\.status = 'approved_private'/);
  assert.match(db, /m\.sanitized_at IS NOT NULL/);
  assert.match(db, /JOIN realization_media_intake m ON m\.id = link\.media_id AND m\.status = 'approved_private' AND m\.sanitized_at IS NOT NULL/);
  assert.match(db, /JOIN photo_upload_invites i ON i\.id = m\.invite_id AND i\.business_job_id IS NOT DISTINCT FROM d\.business_job_id/);
  assert.match(db, /invite\.business_job_id IS NOT DISTINCT FROM \$2::uuid/);
  assert.match(db, /businessJobId\?: string \| null/);
  assert.match(db, /EXISTS \(SELECT 1 FROM photo_upload_invites job_invite/);
  assert.match(db, /ALTER TABLE realization_case_drafts ADD COLUMN IF NOT EXISTS business_job_id uuid REFERENCES business_jobs\(id\) ON DELETE SET NULL/);
  assert.match(db, /media\.status='approved_private' AND media\.sanitized_at IS NOT NULL/);
  assert.match(db, /options\.approvedOnly[\s\S]{0,60}status = 'approved_private'/);
  assert.match(db, /export async function setRealizationCaseDraftMedia/);
  assert.match(db, /export async function transitionRealizationCaseDraft/);
  assert.match(db, /rightsConfirmed \|\| !input\.locationConfirmed \|\| !input\.contentConfirmed/);
  assert.match(db, /isPublishableRealizationLocality\(locality, localityPrecision as 'none' \| 'municipality' \| 'district'\)/);
  assert.match(page, /Lokalita je bezpečne zovšeobecnená alebo ju z verejného prípadu úplne vynechávame/);
  assert.match(page, /Bez lokality – nezobrazovať na mape/);
  assert.match(page, /vymažte aj pole „Obec alebo približná lokalita“/);
  assert.match(db, /photo-intake\/sanitized\//);
  assert.match(db, /export async function listPublishedRealizationCases/);
  assert.match(db, /export async function getPublishedRealizationCasePhoto/);
  const publicCasesRead = db.split('export async function listPublishedRealizationCases')[1]?.split('export async function getPublishedRealizationCasePhoto')[0] ?? '';
  const publicPhotoRead = db.split('export async function getPublishedRealizationCasePhoto')[1]?.split('export async function createCaseDraftFromApprovedPhoto')[0] ?? '';
  for (const publicRead of [publicCasesRead, publicPhotoRead]) {
    assert.match(publicRead, /job\.is_test_data=false/, 'testovacia zákazka nesmie byť verejná');
    assert.match(publicRead, /source_lead\.id=job\.lead_id AND source_lead\.is_test_data=true/, 'testovací zdrojový dopyt nesmie byť verejný');
  }
  assert.match(jobActions.split('export async function setBusinessJobTestDataAction')[1]?.split('export async function deleteBusinessJobAction')[0] ?? '', /revalidatePath\('\/realizacie'\)/);
  assert.match(leadActions.split('export async function setLeadTestDataAction')[1]?.split('export async function deleteLeadFileAction')[0] ?? '', /revalidatePath\('\/realizacie'\)/);
  assert.match(db, /case_draft_created/);
  assert.match(db, /export async function createCaseDraftFromApprovedPhoto/);
  assert.match(db, /status !== 'approved_private'[\s\S]{0,100}sanitized_at/);
  assert.match(db, /FOR SHARE OF media/);
  assert.match(db, /pg_advisory_xact_lock\(hashtext\(\$1\), 74321\)/);
  assert.match(db, /status IN \('DEMONT_DOKONCENA', 'DOKONCENA', 'VYUCTOVANIE'\) FOR UPDATE/);
  assert.match(db, /case_draft_created_from_photo/);
  assert.match(db, /case_draft_photo_attached_from_intake/);
  assert.match(db, /WHERE business_job_id=\$1[\s\S]{0,180}ORDER BY \(lifecycle='draft'\) DESC/);
  assert.match(db, /locality_precision, object_type, business_job_id, updated_by\)/);
  assert.match(photoActions, /verifyCsrf\(formData\)/);
  assert.match(photoActions, /requireSuperAdmin\(\)/);
  assert.match(photoActions, /createCaseDraftFromApprovedPhoto/);
  assert.match(photoActions, /result\.attached && hasPrefill \? 'attached-metadata'/);
  assert.match(db, /localityPrefilled: boolean; objectTypePrefilled: boolean/);
  assert.match(db, /localityPrefilled, objectTypePrefilled/);
  assert.match(page, /Doplnili sa chýbajúce údaje z fotografie\. Fotografia už bola pripojená/);
  assert.match(db, /už má rozpracovaný alebo zverejnený prípad/);
  assert.match(photoPage, /Pripraviť alebo otvoriť koncept realizácie/);
  assert.match(photoPage, /predvyplní iba lokalitu a typ objektu/);
  assert.match(photoPage, /Text, presnosť lokality aj publikovanie musí potvrdiť človek/);
  assert.match(visualStyles, /\.photo-admin-grid article \.photo-case-draft-action \{ display: grid; gap: 6px; width: 100%/);
  assert.match(visualStyles, /\.photo-case-draft-action button:focus-visible \{ outline: 3px solid/);
  assert.match(page, /requireSuperAdmin\(\)/);
  assert.match(page, /Uloženie nič nezverejní/);
  assert.match(page, /approvedOnly: true, page: photoPage, pageSize: 50/,
    'schválené fotky sa majú stránkovať po SQL filtri');
  assert.match(page, /name="businessJobId"/);
  assert.match(page, /photo\.businessJobId === selected\.businessJobId/);
  assert.match(page, /selected\?\.businessJobId && !jobs\.some/,
    'už priradená historická zákazka musí zostať explicitne vybraná aj mimo nového zoznamu');
  assert.match(page, /Stránka schválených fotografií|Stránkovanie schválených fotografií/);
  assert.doesNotMatch(page, /name="mediaIds"/, 'uloženie textu nesmie meniť väzby na fotky');
  assert.match(page, /setCaseDraftPhotoAction/);
  assert.match(visualStyles, /\.admin-case-draft-form\s*\{\s*display: grid/);
  assert.match(visualStyles, /\.admin-case-draft-form \{ grid-template-columns: 1fr; \}/);
  assert.match(visualStyles, /\.admin-case-draft-form \.admin-form-checkbox input\[type="checkbox"\]\s*\{\s*width: 18px/);
  assert.match(visualStyles, /\.admin-case-review-preview dd \{[^}]*overflow-wrap: anywhere/);
  assert.match(visualStyles, /\.admin-case-review-preview dl > div \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(actions, /verifyCsrf\(formData\)/);
  assert.match(actions, /requireSuperAdmin\(\)/);
  assert.match(actions, /Vyberte dokončenú CRM zákazku/);
  assert.match(actions, /transitionRealizationCaseDraft/);
  assert.match(actions, /transitionCaseDraftAction/);
  assert.match(page, /Odovzdať na redakčné posúdenie/);
  assert.match(page, /Schváliť na zverejnenie/);
  assert.match(page, /Zverejniť schválený prípad/);
  assert.match(page, /Stiahnuť z verejnej stránky/);
  assert.match(page, /Schválenie sa zruší a pred zverejnením bude potrebné nové redakčné posúdenie aj nové potvrdenie/);
  assert.match(page, /Náhľad uzamknutého obsahu/);
  assert.match(page, /Očistená fotografia prípadu na redakčnú kontrolu/);
  const transitionForms = [...page.matchAll(/<form action=\{transitionCaseDraftAction\}[\s\S]*?<\/form>/g)].map(([form]) => form);
  assert.equal(transitionForms.length, 6, 'každý lifecycle krok vrátane návratu zo schválenia na úpravu má vlastný serverový formulár');
  const transitionTargets = transitionForms.map((form) => form.match(/name="nextLifecycle" value="([^"]+)"/)?.[1]);
  assert.deepEqual(new Set(transitionTargets), new Set(['reviewed', 'approved', 'draft', 'published', 'withdrawn']));
  assert.equal(transitionForms.filter((form) => form.includes('name="publicationEvidence"')).length, 1,
    'iba formulár schválenia odosiela dôkaz publikovania');
  assert.match(actions, /nextLifecycle === 'approved' \? text\(formData, 'publicationEvidence', 500\) : ''/,
    'ostatné kroky nesmú vyžadovať pole schvaľovacieho dôkazu');
  assert.match(nav, /Koncepty prípadov', icon: 'doc', superOnly: true/);
  assert.doesNotMatch(publicPage, /listRealizationCaseDrafts|realization_case_drafts/);
  assert.doesNotMatch(gallery, /listRealizationCaseDrafts|realization_case_drafts/);
  assert.doesNotMatch(sitemap, /listRealizationCaseDrafts|realization_case_drafts/);
  assert.match(mediaRoute, /getPublishedRealizationCasePhoto\(id\)/);
  assert.match(mediaRoute, /privatePhotoIntakeStorageReady\(\)/);
  assert.match(mediaRoute, /verifiedImageMime\(bytes\) !== 'image\/jpeg'/);
  assert.match(mediaRoute, /Cache-Control': 'no-store/);
  assert.match(mediaRoute, /parsePublicRealizationImageWidth\(request\.url\)/);
  assert.match(mediaRoute, /getPublicRealizationPhotoVariant\(photo\.storageKey, width, loadVerifiedSource\)/);
  assert.match(mediaRoute, /width === undefined/);
  assert.match(mediaRoute, /consumeSharedRateLimit\([\s\S]*?'public-realization-image'[\s\S]*?120,[\s\S]*?60_000/);
  assert.doesNotMatch(mediaRoute, /width\s*!==\s*null\s*&&\s*await\s+consumeSharedRateLimit/);
  assert.match(mediaRoute, /PublicRealizationMediaBusyError/);
  assert.match(mediaRoute, /Cross-Origin-Resource-Policy': 'same-origin'/);
  assert.match(mediaRoute, /Referrer-Policy': 'no-referrer/);
});
