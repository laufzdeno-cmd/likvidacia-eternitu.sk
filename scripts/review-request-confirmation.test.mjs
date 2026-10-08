import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('a review request is recorded as sent only after an explicit admin confirmation', async () => {
  const [page, actions, tools] = await Promise.all([
    readFile(new URL('../app/admin/(protected)/reviews/request/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/reviews/request/actions.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/reviews/request/review-request-tools.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /name="sentConfirmed" type="checkbox" required/);
  assert.match(page, /Správu som zákazníkovi skutočne odoslal/);
  assert.match(tools, /Potvrdiť odoslanie a uložiť/);
  assert.match(actions, /const sentConfirmed = formData\.get\('sentConfirmed'\) === 'on'/);
  assert.match(actions, /if \(!customerName \|\| !phone \|\| !googleReviewLink \|\| !sentConfirmed\) \{[\s\S]*result=invalid/);
  assert.match(actions, /status: 'sent'/);
  assert.match(actions, /result=invalid&attempt=\$\{randomUUID\(\)\}/);
  assert.match(actions, /result=saved&attempt=\$\{reviewRequest\.id\}/);
  assert.match(tools, /role=\{invalid \? 'alert' : 'status'\}/);
  assert.doesNotMatch(page, /className="admin-pending-form"/);
  assert.match(page, /<ReviewRequestSubmit \/>/);
  assert.match(page, /<ReviewRequestResult result=\{result\} attempt=\{attempt\} \/>/);
  assert.match(tools, /resultRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(tools, /\[result, attempt\]/);
  assert.match(tools, /ref=\{resultRef\}[\s\S]*tabIndex=\{-1\}/);
  assert.match(tools, /useFormStatus\(\)/);
  assert.match(tools, /disabled=\{pending\}/);
  assert.match(tools, /pending \? 'Ukladám potvrdenie…'/);
  assert.match(tools, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(tools, /navigator\.clipboard\.writeText\(message\)/);
  assert.match(tools, /catch \{/);
  assert.match(tools, /skopírujte ho ručne/);
  assert.match(tools, /role="alert" aria-live="assertive"/);
});
