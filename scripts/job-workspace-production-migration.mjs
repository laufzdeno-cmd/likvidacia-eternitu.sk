/** Explicit, approved release operation. No customer rows or credentials are printed or saved locally. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { get, put } from '@vercel/blob';
import { normalizeDatabaseUrl } from '../src/server/database-config.ts';
import { deploymentDatabaseIdentity, deploymentResourceFingerprint, vercelBlobStoreId } from '../src/server/preview-safety.ts';
import { migrateJobWorkspaceSchema } from '../src/server/job-workspace-migration.ts';
import { migrateJobMailSchema } from '../src/server/job-mail-migration.ts';

const approvedProject = 'prj_33bexlmoSP20DpesVJ4gWVHmZtkH';
const approvedTeam = 'team_YXyTmAek7bBSOa6iNb2nI41A';
const approvedDatabase = 'cd86bb013d29ecd288531e4de1df53bb756724183b80dc4589d9f170c6486908';
// Independently checked through Vercel store metadata: private and connected to approvedProject.
const approvedBackupStore = '72b8b208f1f79c5d58959c6303c2d61e613c153b2fdfbc23eb89580080f22b01';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const identifier = value => { assert.match(value, /^[a-zA-Z0-9_]+$/); return `"${value}"`; };
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : '';
const report = { checkedAt: new Date().toISOString(), operation: apply ? 'apply' : 'check', backupVerified: false, committed: false };
let pool, client, transaction = false;
let stage = 'target';
try {
  assert.ok(args.every((x, i) => ['--apply','--confirm-source'].includes(x) || args[i - 1] === '--confirm-source'));
  const linked = JSON.parse(await readFile('.vercel/project.json', 'utf8'));
  assert.equal(linked.projectId, approvedProject); assert.equal(linked.orgId, approvedTeam);
  const identity = deploymentDatabaseIdentity(process.env.DATABASE_URL);
  assert.ok(identity); assert.equal(deploymentResourceFingerprint(identity), approvedDatabase);
  if (process.env.PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256) assert.equal(process.env.PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256, approvedDatabase);
  assert.notEqual(process.env.ASTANA_JOB_GMAIL_VERIFIED, 'true');
  const source = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8',windowsHide:true}).trim();
  if (apply) {
    assert.equal(option('--confirm-source'), source);
    assert.equal(execFileSync('git', ['status', '--porcelain'], {encoding:'utf8',windowsHide:true}).trim(), '');
    assert.ok(process.env.BLOB_READ_WRITE_TOKEN);
    assert.equal(deploymentResourceFingerprint(vercelBlobStoreId(process.env.BLOB_READ_WRITE_TOKEN)), approvedBackupStore);
  }
  report.source = source; report.databaseFingerprint = approvedDatabase; report.gmailVerified = false;
  const directUrl = new URL(normalizeDatabaseUrl(process.env.DATABASE_URL));
  directUrl.hostname = directUrl.hostname.replace(/-pooler(?=\.)/, '');
  // Same verified endpoint/database, direct transport for transactional DDL. TLS is never weakened.
  assert.equal(deploymentDatabaseResource(directUrl), approvedDatabase);
  // Preserve SQL DATE, timestamp and timestamptz text exactly, including microseconds.
  // The default pg Date parser otherwise shifts calendar days in Europe/Bratislava.
  const backupTypes={getTypeParser(oid,format){return [1082,1114,1184].includes(oid)&&format!=='binary'?value=>value:pg.types.getTypeParser(oid,format);}};
  pool = new pg.Pool({connectionString:directUrl.toString(),types:backupTypes,max:1,connectionTimeoutMillis:10000,statement_timeout:20000});
  client = await pool.connect();
  const inventory = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  assert.ok(inventory.rows.some(x => x.table_name === 'business_jobs'));
  report.tableCountBefore = inventory.rowCount;
  if (apply) {
    stage = 'consistent-private-backup';
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); transaction = true;
    const tables = {};
    const snapshotInventory = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
    for (const {table_name} of snapshotInventory.rows) {
      if (table_name !== 'analytics_events') tables[table_name] = (await client.query(`SELECT * FROM public.${identifier(table_name)}`)).rows;
    }
    const columns = (await client.query("SELECT table_name,column_name,udt_name,is_nullable,column_default,numeric_precision,numeric_scale,character_maximum_length,datetime_precision,is_generated FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
    const constraints = (await client.query("SELECT c.relname AS table_name,con.conname,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,con.conname")).rows;
    const indices = (await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows;
    await client.query('COMMIT'); transaction = false;
    const raw = JSON.stringify({exportedAt:new Date().toISOString(),driver:'postgres',excludedTables:['analytics_events'],tables,schema:{columns,constraints,indices},source});
    assert.ok(Buffer.byteLength(raw) < 100 * 1024 * 1024);
    const key = `release-backups/job-workspace/${Date.now()}-${randomUUID()}/db-backup.json`;
    const object = await put(key, raw, {access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
    const downloaded = await get(object.pathname, {access:'private',useCache:false});
    assert.equal(downloaded?.statusCode,200); assert.ok(downloaded.stream);
    const restoredBytes = Buffer.from(await new Response(downloaded.stream).arrayBuffer());
    assert.equal(sha(restoredBytes),sha(raw));
    const anonymous = await fetch(object.url,{redirect:'manual',signal:AbortSignal.timeout(10000)});
    assert.ok([401,403,404].includes(anonymous.status),'Backup must not be anonymously readable.');
    report.backupVerified = true; report.backupPath = object.pathname; report.backupSha256 = sha(raw); report.backupBytes = Buffer.byteLength(raw);
    report.backupTableCount = Object.keys(tables).length;
    // Store only recovery metadata locally before any production DDL.
    await mkdir('test-results',{recursive:true});
    await writeFile('test-results/job-workspace-production-migration.json',JSON.stringify({...report,stage:'backup-complete'},null,2));
    stage = 'isolated-restore-drill';
    const isolatedEnvironment=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC','TEMP','TMP'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
    const child=spawn(process.execPath,['--import','tsx','--import','./scripts/test-loopback-network-guard.mjs','scripts/job-workspace-backup-drill.mjs'],{env:{...isolatedEnvironment,NODE_ENV:'test',ASTANA_TEST_NETWORK_GUARD:'1'},windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output=''; child.stdout.on('data',data=>{output+=data.toString();}); child.stderr.resume();
    const completed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    child.stdin.on('error',()=>undefined);child.stdin.end(restoredBytes);
    const timeout=setTimeout(()=>child.kill(),180000);timeout.unref();
    let exit;try { exit=await completed; } finally { clearTimeout(timeout); }
    const drill=JSON.parse(output);report.restoreDrill=drill;
    assert.equal(exit,0);assert.equal(drill.ok,true);assert.equal(drill.tableCount,Object.keys(tables).length);
    stage = 'forward-migration';
    await client.query('BEGIN'); transaction = true;
    await client.query("SET LOCAL lock_timeout='1500ms'; SET LOCAL statement_timeout='20000ms'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('astana-job-workspace-2026-10-27'))");
    await client.query('LOCK TABLE business_jobs IN SHARE ROW EXCLUSIVE MODE');
    const checksum = async () => (await client.query("SELECT md5(coalesce(string_agg(id::text||coalesce(total_price::text,'NULL')||coalesce(demolition_date::text,'NULL'),'|' ORDER BY id),'')) AS hash FROM business_jobs")).rows[0].hash;
    const before = await checksum();
    await migrateJobWorkspaceSchema(client);
    await migrateJobMailSchema(client);
    // Preserve existing history but force all mailbox synchronization/marking OFF.
    await client.query("UPDATE job_mail_workspace_state SET payload=jsonb_set(jsonb_set(payload,'{configuration,enabled}','false'::jsonb),'{configuration,verificationAcknowledged}','false'::jsonb),updated_at=now() WHERE id=1");
    const oldMail = await client.query("SELECT to_regclass('public.gmail_price_offer_connections') IS NOT NULL AS present");
    if (oldMail.rows[0].present) await client.query('UPDATE gmail_price_offer_connections SET active=false WHERE active=true');
    if (oldMail.rows[0].present) assert.equal((await client.query('SELECT count(*)::int AS count FROM gmail_price_offer_connections WHERE active=true')).rows[0].count,0);
    assert.equal(await checksum(),before,'Migration must preserve all job prices and dates.');
    await verifySchema(client);
    await client.query('COMMIT'); transaction = false; report.committed = true;
  }
  stage = 'post-check';
  report.schema = await verifySchema(client, !apply);
  report.ok = true;
} catch (error) {
  if (transaction) await client?.query('ROLLBACK').catch(() => undefined);
  report.ok = false; report.stage = stage;
  report.code = /^[A-Z0-9_]{2,30}$/.test(error.code || '') ? error.code : 'BOUNDED_CHECK_FAILED';
  process.exitCode = 1;
} finally {
  client?.release(); await pool?.end();
  await mkdir('test-results',{recursive:true});
  await writeFile(`test-results/job-workspace-production-${apply?'migration':'preflight'}.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
function deploymentDatabaseResource(url) { return deploymentResourceFingerprint(deploymentDatabaseIdentity(url.toString())); }
async function verifySchema(db, allowMissing = false) {
  const names=['job_workspaces','job_workspace_manual_offers','job_workspace_notices','job_workspace_documents','job_workspace_communications','job_mail_workspace_state'];
  const states=[];
  for(const name of names) states.push((await db.query('SELECT to_regclass($1) IS NOT NULL AS present',[`public.${name}`])).rows[0].present);
  if (!allowMissing) assert.ok(states.every(Boolean));
  let gmailOff=true;
  if(states[5]) {
    const r=await db.query("SELECT coalesce((payload#>>'{configuration,enabled}')::boolean,false) AS enabled,coalesce((payload#>>'{configuration,verificationAcknowledged}')::boolean,false) AS acknowledged FROM job_mail_workspace_state WHERE id=1");
    gmailOff=r.rowCount===1&&!r.rows[0].enabled&&!r.rows[0].acknowledged; assert.ok(gmailOff);
  }
  if(!allowMissing) {
    const c=await db.query("SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='business_jobs' AND column_name IN ('total_price','demolition_date','total_price_overridden','actual_date_overridden')");
    assert.equal(c.rowCount,4);
    assert.ok(c.rows.filter(x=>['total_price','demolition_date'].includes(x.column_name)).every(x=>x.is_nullable==='YES'));
  }
  return {featureTables:states.filter(Boolean).length,expectedFeatureTables:6,gmailOff};
}
