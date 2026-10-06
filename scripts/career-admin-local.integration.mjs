import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('legacy local career records preserve attached CV and count only truly incomplete CVs', async () => {
  const scratch = await mkdtemp(path.join(tmpdir(), 'astana-career-admin-'));
  const fixturePath = path.join(scratch, 'local-db.json');
  try {
    const now = new Date().toISOString();
    const makeApplication = (name, cv) => ({
      id: randomUUID(), submissionId: randomUUID(), createdAt: now, updatedAt: now,
      status: 'new', fullName: name, phone: '+421900000001', email: 'test@example.invalid', city: 'Poprad',
      cooperationType: 'szco', workRegions: 'Slovensko', hasTradeLicense: true,
      workAtHeights: true, hasAsbestosExperience: false, asbestosExperience: '',
      experience: '', note: '', privacyConsent: true, cvExpected: true, cv,
    });
    const attached = makeApplication('Test s priloženým CV', {
      originalName: 'životopis.pdf', storageDriver: 'local',
      storageKey: 'private/test/attached.pdf', mimeType: 'application/pdf', sizeBytes: 128,
    });
    const incomplete = makeApplication('Test bez priloženého CV');
    await writeFile(fixturePath, JSON.stringify({ careerApplications: [attached, incomplete] }), 'utf8');
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = '';
    process.env.ASTANA_LOCAL_DB_PATH = fixturePath;
    const { countCareerApplications, getCareerApplication, listCareerApplications } = await import('../src/server/db.ts');
    assert.deepEqual(await countCareerApplications(), { total: 2, incompleteCv: 1 });
    assert.equal((await listCareerApplications(1, 1))[0]?.id, incomplete.id);
    assert.equal((await listCareerApplications(2, 1))[0]?.id, attached.id);
    assert.equal((await getCareerApplication(attached.id))?.cv?.storageKey, attached.cv.storageKey);
    assert.equal((await getCareerApplication(incomplete.id))?.cv, undefined);
    assert.equal(JSON.parse(await readFile(fixturePath, 'utf8')).careerApplications.length, 2);
  } finally {
    await rm(fixturePath, { force: true });
    await rmdir(scratch);
  }
});
