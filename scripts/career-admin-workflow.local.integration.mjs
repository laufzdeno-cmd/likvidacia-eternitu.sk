import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('local career CRM migrates legacy rows, filters workflow, archives/restores and audits without applicant PII', async () => {
  const scratch = await mkdtemp(path.join(process.cwd(), '.tmp-career-workflow-'));
  const fixturePath = path.join(scratch, 'local-db.json');
  const actorEmail = 'admin@example.invalid';
  const legacyId = randomUUID();
  const reviewedId = randomUUID();
  const archivedId = randomUUID();
  const timestamp = '2026-10-01T08:00:00.000Z';

  const application = (id, overrides = {}) => ({
    id,
    submissionId: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'new',
    fullName: `Citlivé meno ${id}`,
    phone: '+421900123456',
    email: `${id}@candidate.example.invalid`,
    city: 'Poprad',
    cooperationType: 'szco',
    workRegions: 'Celé Slovensko',
    hasTradeLicense: true,
    workAtHeights: true,
    hasAsbestosExperience: true,
    asbestosExperience: 'Citlivý opis práce s azbestom',
    experience: 'Citlivý opis skúseností',
    note: 'Citlivá poznámka uchádzača',
    privacyConsent: true,
    cvExpected: false,
    ...overrides,
  });

  const legacy = application(legacyId);
  const reviewed = application(reviewedId, {
    status: 'reviewed',
    ownerEmail: 'owner@example.invalid',
    nextAction: 'Zavolať uchádzačovi',
    followupDate: '2000-01-01',
  });
  const archived = application(archivedId, {
    status: 'archived',
    ownerEmail: 'owner@example.invalid',
    nextAction: 'Starý interný krok',
    followupDate: '2000-01-02',
  });

  try {
    await writeFile(fixturePath, JSON.stringify({
      careerApplications: [legacy, reviewed, archived],
      auditLogs: [],
      adminUsers: [
        { id: randomUUID(), email: 'owner@example.invalid', name: 'Vlastník testu', role: 'OPERATOR', active: true },
      ],
    }), 'utf8');

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = '';
    process.env.ASTANA_LOCAL_DB_PATH = fixturePath;

    const database = await import('../src/server/db.ts');
    for (const name of [
      'countCareerApplications',
      'listCareerApplications',
      'getCareerApplication',
      'updateCareerApplicationWorkflow',
      'archiveCareerApplication',
      'restoreCareerApplication',
    ]) {
      assert.equal(typeof database[name], 'function', `Chýba požadované DB API: ${name}`);
    }

    const legacyRow = await database.getCareerApplication(legacyId);
    assert.equal(legacyRow.status, 'new');
    assert.equal(legacyRow.ownerEmail, '');
    assert.equal(legacyRow.nextAction, '');
    assert.equal(legacyRow.followupDate, '');

    assert.equal((await database.countCareerApplications()).total, 2, 'archivované žiadosti sa štandardne nepočítajú');
    assert.deepEqual(
      new Set((await database.listCareerApplications(1, 50)).map((item) => item.id)),
      new Set([legacyId, reviewedId]),
      'štandardný zoznam nesmie obsahovať archivovanú žiadosť',
    );
    assert.deepEqual((await database.listCareerApplications(1, 50, { status: 'reviewed' })).map((item) => item.id), [reviewedId]);
    assert.deepEqual((await database.listCareerApplications(1, 50, { unassignedOnly: true })).map((item) => item.id), [legacyId]);
    assert.deepEqual((await database.listCareerApplications(1, 50, { ownerEmail: 'OWNER@EXAMPLE.INVALID' })).map((item) => item.id), [reviewedId]);
    assert.deepEqual((await database.listCareerApplications(1, 50, { dueOnly: true })).map((item) => item.id), [reviewedId]);
    assert.deepEqual((await database.listCareerApplications(1, 50, { status: 'archived' })).map((item) => item.id), [archivedId]);
    assert.equal((await database.countCareerApplications({ status: 'archived' })).total, 1);

    const nextAction = 'Telefonicky overiť dostupnosť v stredu';
    const updated = await database.updateCareerApplicationWorkflow(legacyId, {
      status: 'reviewed',
      ownerEmail: 'OWNER@EXAMPLE.INVALID',
      nextAction,
      followupDate: '2026-10-20',
      expectedUpdatedAt: legacyRow.updatedAt,
    }, actorEmail);
    assert.equal(updated.status, 'reviewed');
    assert.equal(updated.ownerEmail, 'owner@example.invalid');
    assert.equal(updated.nextAction, nextAction);
    assert.equal(updated.followupDate, '2026-10-20');

    await assert.rejects(
      database.updateCareerApplicationWorkflow(legacyId, {
        status: 'new', ownerEmail: '', nextAction: 'Starší formulár', followupDate: '', expectedUpdatedAt: legacyRow.updatedAt,
      }, actorEmail),
      /medzitým zmenená/,
    );
    assert.equal((await database.getCareerApplication(legacyId)).nextAction, nextAction, 'starší formulár nesmie prepísať novší workflow');

    const afterUpdate = JSON.parse(await readFile(fixturePath, 'utf8'));
    const updateAudit = afterUpdate.auditLogs.find((entry) => entry.entityId === legacyId && entry.action === 'career_application_workflow_updated');
    assert.ok(updateAudit, 'workflow zmena musí byť auditovaná v tom istom zápise');
    assert.deepEqual(new Set(updateAudit.changes.changedFields), new Set(['status', 'ownerEmail', 'nextAction', 'followupDate']));
    assert.equal(updateAudit.changes.previousStatus, 'new');
    assert.equal(updateAudit.changes.nextStatus, 'reviewed');
    assert.equal(updateAudit.changes.ownerEmail, 'owner@example.invalid');
    assert.equal(updateAudit.changes.followupDate, '2026-10-20');

    const archivedResult = await database.archiveCareerApplication(legacyId, actorEmail);
    assert.equal(archivedResult.status, 'archived');
    assert.equal((await database.listCareerApplications(1, 50)).some((item) => item.id === legacyId), false);
    assert.equal((await database.listCareerApplications(1, 50, { status: 'archived' })).some((item) => item.id === legacyId), true);

    const restored = await database.restoreCareerApplication(legacyId, actorEmail);
    assert.notEqual(restored.status, 'archived');
    assert.equal(restored.ownerEmail, 'owner@example.invalid');
    assert.equal(restored.nextAction, nextAction);
    assert.equal(restored.followupDate, '2026-10-20');
    assert.equal((await database.listCareerApplications(1, 50)).some((item) => item.id === legacyId), true);

    const persisted = JSON.parse(await readFile(fixturePath, 'utf8'));
    const audit = persisted.auditLogs.filter((entry) => entry.entityType === 'career_application' && entry.entityId === legacyId);
    assert.equal(audit.length, 3, 'update, archivácia a obnova musia mať po jednom atómovom audite');
    assert.deepEqual(new Set(audit.map((entry) => entry.action)), new Set([
      'career_application_workflow_updated',
      'career_application_archived',
      'career_application_restored',
    ]));

    const allowedAuditKeys = new Set(['changedFields', 'previousStatus', 'nextStatus', 'ownerEmail', 'followupDate']);
    const forbiddenValues = [
      legacy.fullName,
      legacy.phone,
      legacy.email,
      legacy.asbestosExperience,
      legacy.experience,
      legacy.note,
      nextAction,
      'zivotopis.pdf',
    ];
    for (const entry of audit) {
      assert.equal(entry.actorEmail, actorEmail);
      for (const key of Object.keys(entry.changes)) assert.ok(allowedAuditKeys.has(key), `Audit obsahuje nepovolený kľúč: ${key}`);
      const serializedChanges = JSON.stringify(entry.changes);
      for (const value of forbiddenValues) assert.equal(serializedChanges.includes(value), false, `Audit prezradil citlivú hodnotu: ${value}`);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
