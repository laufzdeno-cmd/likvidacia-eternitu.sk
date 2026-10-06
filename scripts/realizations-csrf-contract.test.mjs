import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('every admin realization mutation form submits CSRF and actions keep verification and admin authorization', async () => {
  const [page, actions] = await Promise.all([
    readFile(new URL('../app/admin/(protected)/realizacie/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/realizacie/actions.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /import \{ csrfTokenForEmail, requireAdminUser \} from '@\/src\/server\/auth';/);
  assert.match(page, /requireAdminUser\(\)/);
  assert.match(page, /csrfTokenForEmail\(admin\.email\)/);

  const mutationForms = [...page.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(([form]) => form);
  assert.equal(mutationForms.length, 2, 'the create form and status form template must both be present');
  for (const form of mutationForms) {
    assert.match(form, /action=\{(?:createRealizationAction|updateRealizationStatusAction)\}/);
    assert.match(form, /<input\s+type="hidden"\s+name="_csrf"\s+value=\{csrfToken\}\s*\/>/);
  }

  for (const actionName of ['createRealizationAction', 'updateRealizationStatusAction']) {
    assert.match(actions, new RegExp(`export async function ${actionName}\\(formData: FormData\\) \\{\\s*await verifyCsrf\\(formData\\);\\s*const actorEmail = await requireAdmin\\(\\);`));
  }
  assert.equal((actions.match(/await verifyCsrf\(formData\);/g) || []).length, 2);
  assert.equal((actions.match(/await requireAdmin\(\);/g) || []).length, 2);
  assert.match(page, /Nová položka sa uloží ako rozpracovaná/);
  assert.match(page, /name="publicationRightsConfirmed" required/);
  assert.match(page, /name="publicationLocationConfirmed" required/);
  assert.match(page, /name="publicationEvidence" minLength=\{4\}/);
  assert.match(actions, /status === 'published' && \(!rightsConfirmed \|\| !locationConfirmed \|\| evidence\.length < 4\)/);
  assert.doesNotMatch(await readFile(new URL('../app/realizacie/page.tsx', import.meta.url), 'utf8'), /publicationEvidence|publicationApprovedBy|publicationApprovedAt/);
});
