import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function main() {
  const testDirectory = await mkdtemp(path.join(os.tmpdir(), 'astana-prelaunch-v5-'));
  process.env.ASTANA_LOCAL_DB_PATH = path.join(testDirectory, 'local-db.json');
  process.env.DATABASE_URL = '';
  process.env.SMTP_HOST = '';
  process.env.META_CAPI_ACCESS_TOKEN = '';
  process.env.NEXT_PUBLIC_META_PIXEL_ID = '';
  process.env.META_GRAPH_API_VERSION = '';

  const { createLeadWithMetaCapiOutbox } = await import('../src/server/db');
  const { leadSchema } = await import('../src/server/validation');

  const submit = async (areaEstimate: number) => {
    const values = {
      fullName: 'Lokálny V5 test',
      phone: '0905000000',
      email: `local-v5-${randomUUID()}@example.test`,
      city: 'Nitra',
      objectType: 'Rodinný dom',
      materialType: 'Vlnitý eternit',
      preferredContact: 'Zavolajte mi',
      gdpr: 'on',
      areaEstimateStatus: 'known',
    };
    const parsed = leadSchema.safeParse({ ...values, areaEstimate });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const saved = await createLeadWithMetaCapiOutbox({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      city: parsed.data.city,
      district: parsed.data.district,
      objectType: parsed.data.objectType,
      materialType: parsed.data.materialType,
      areaEstimate: parsed.data.areaEstimate!,
      preferredContact: parsed.data.preferredContact,
      roofer: parsed.data.roofer,
      term: parsed.data.term,
      note: parsed.data.note,
      gdpr: true,
      rawData: { areaEstimateStatus: 'known' },
      source: 'test',
    }, randomUUID());
    assert.equal(saved.created, true);
    assert.equal(saved.businessJob.leadId, saved.lead.id);
  };

  try {
    await submit(120);

    const db = JSON.parse(await readFile(process.env.ASTANA_LOCAL_DB_PATH, 'utf8')) as {
      leads: Array<{ id: string; areaEstimate: number; rawData?: { areaEstimateStatus?: string } }>;
      businessJobs: Array<{ leadId?: string }>;
      metaCapiOutbox: unknown[];
    };
    assert.equal(db.leads.length, 1);
    assert.equal(db.leads[0]?.areaEstimate, 120);
    assert.equal(db.leads[0]?.rawData?.areaEstimateStatus, 'known');
    assert.equal(db.businessJobs.length, 1);
    assert.equal(db.businessJobs[0]?.leadId, db.leads[0]?.id);
    assert.equal(db.metaCapiOutbox.length, 0);
    console.log('PASS: required known area estimate; no-consent CAPI outbox = 0');
  } finally {
    await rm(testDirectory, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
