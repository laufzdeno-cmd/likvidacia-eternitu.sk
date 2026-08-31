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

  const submit = async (areaEstimateStatus: 'known' | 'lead_area_unknown', areaEstimate?: number) => {
    const values = {
      fullName: 'Lokálny V5 test',
      phone: '0905000000',
      email: `local-v5-${randomUUID()}@example.test`,
      city: 'Nitra',
      objectType: 'Rodinný dom',
      materialType: 'Vlnitý eternit',
      preferredContact: 'Zavolajte mi',
      gdpr: 'on',
      areaEstimateStatus,
    };
    const parsed = leadSchema.safeParse({ ...values, areaEstimate: areaEstimate ?? '' });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const unknown = parsed.data.areaEstimateStatus === 'lead_area_unknown';
    const saved = await createLeadWithMetaCapiOutbox({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      city: parsed.data.city,
      district: parsed.data.district,
      objectType: parsed.data.objectType,
      materialType: parsed.data.materialType,
      areaEstimate: unknown ? 0 : parsed.data.areaEstimate!,
      preferredContact: parsed.data.preferredContact,
      roofer: parsed.data.roofer,
      term: parsed.data.term,
      note: parsed.data.note,
      gdpr: true,
      rawData: { areaEstimateStatus: unknown ? 'lead_area_unknown' : 'known' },
      source: 'test',
    }, randomUUID());
    assert.equal(saved.created, true);
  };

  try {
    await submit('known', 120);
    await submit('lead_area_unknown');

    const db = JSON.parse(await readFile(process.env.ASTANA_LOCAL_DB_PATH, 'utf8')) as {
      leads: Array<{ areaEstimate: number; rawData?: { areaEstimateStatus?: string } }>;
      metaCapiOutbox: unknown[];
    };
    assert.equal(db.leads.length, 2);
    const unknown = db.leads.find((lead) => lead.rawData?.areaEstimateStatus === 'lead_area_unknown');
    assert.equal(unknown?.areaEstimate, 0);
    assert.equal(db.metaCapiOutbox.length, 0);
    console.log('PASS: known + lead_area_unknown; no-consent CAPI outbox = 0');
  } finally {
    await rm(testDirectory, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
