import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Meta reviewer is restricted to the Facebook inbox', () => {
  const auth = read('src/server/auth.ts');
  const layout = read('app/admin/(protected)/layout.tsx');
  const login = read('app/admin/login/submit/route.ts');

  assert.match(auth, /user\.role === 'META_REVIEWER'.*\/admin\/facebook\?access=restricted/s);
  assert.match(auth, /role === 'META_REVIEWER'[\s\S]+pathname === '\/admin\/facebook'/);
  assert.match(layout, /canAccessAdminPath\(user\.role, pathname\)/);
  assert.match(login, /user\.role === 'META_REVIEWER' \? '\/admin\/facebook' : '\/admin\/dopyty'/);
});

test('Meta reviewer cannot see CRM linking or staff identities', () => {
  const page = read('app/admin/(protected)/facebook/[id]/page.tsx');
  const list = read('app/admin/(protected)/facebook/page.tsx');
  const actions = read('app/admin/(protected)/facebook/actions.ts');

  assert.match(page, /isReviewer \? Promise\.resolve\(\[\]\) : listAdminTaskAssignees\(\)/);
  assert.match(page, /getFacebookConversation\(id, reviewParticipantId\)/);
  assert.match(page, /!isReviewer \? <aside className="facebook-thread-sidebar">/);
  assert.match(page, /isReviewer \? 'ASTANA tím' : message\.sentBy/);
  assert.match(list, /!isReviewer \? <label>Pridelenie/);
  assert.match(list, /participantId: reviewParticipantId/);
  assert.match(actions, /sendFacebookReplyAction[\s\S]+requireFacebookAdminUser\(\)/);
  assert.match(actions, /admin\.role === 'META_REVIEWER' \? config\.reviewParticipantId : ''/);
  assert.match(actions, /expectedParticipantId,/);
  assert.match(actions, /saveFacebookConversationWorkflowAction[\s\S]+requireAdminUser\(\)/);
});

test('Meta reviewer is never offered as an internal assignee', () => {
  const db = read('src/server/db.ts');
  const lead = read('app/admin/(protected)/dopyty/[id]/page.tsx');
  const career = read('app/admin/(protected)/kariera/[id]/page.tsx');

  assert.match(db, /user\.active && user\.role !== 'META_REVIEWER'/);
  assert.match(db, /role <> 'META_REVIEWER'/);
  assert.match(lead, /user\.active && user\.role !== 'META_REVIEWER'/);
  assert.match(career, /user\.active && user\.role !== 'META_REVIEWER'/);
});
