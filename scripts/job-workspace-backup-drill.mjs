/** Receive a private snapshot through stdin, restore only in-memory, output aggregate evidence only. */
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
let database,server,pool;
let stage='input';
let schemaContext={};
const identifier=value=>{assert.match(value,/^[a-zA-Z0-9_]+$/);return `"${value}"`;};
try{
 assert.equal(process.env.ASTANA_TEST_NETWORK_GUARD,'1');assert.ok(!process.env.DATABASE_URL&&!process.env.BLOB_READ_WRITE_TOKEN);
 const chunks=[];let length=0;
 for await(const bytes of process.stdin){length+=bytes.length;assert.ok(length<=100*1024*1024);chunks.push(bytes);}
 const backup=JSON.parse(Buffer.concat(chunks).toString());assert.equal(backup.driver,'postgres');
 const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 stage='isolated-postgres';database=await PGlite.create();server=new PGLiteSocketServer({db:database,port,host:'127.0.0.1',maxConnections:8});await server.start();
 process.env.DATABASE_URL=`postgres://restore:restore@127.0.0.1:${port}/restore`;process.env.DATABASE_POOL_MAX='1';
 stage='isolated-schema';const app=await import('../src/server/db.ts');await app.ensureServerDatabaseSchema();pool=app.getServerDatabasePool();
 await app.migrateAdminAssistantSchemaOnce(pool);await app.migrateAdminPracticalSchemaOnce(pool);
 await (await import('../src/server/facebook-messenger-db.ts')).ensureFacebookMessengerSchema();
 await (await import('../src/server/job-workspace-migration.ts')).migrateJobWorkspaceSchema(pool);
 await (await import('../src/server/job-mail-migration.ts')).migrateJobMailSchema(pool);
 stage='inventory';const target=(await database.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows.map(x=>x.table_name);
 const tables=Object.keys(backup.tables);assert.ok(tables.every(table=>target.includes(table)));
 // Incremental production history can retain columns absent from a fresh app bootstrap.
 // Replay them only in this in-memory copy, using an explicit primitive-type allowlist.
 const primitiveTypes={text:'text',varchar:'varchar',bpchar:'char',int2:'smallint',int4:'integer',int8:'bigint',float4:'real',float8:'double precision',numeric:'numeric',bool:'boolean',uuid:'uuid',date:'date',timestamp:'timestamp',timestamptz:'timestamptz',json:'json',jsonb:'jsonb',bytea:'bytea',_text:'text[]',_uuid:'uuid[]',_int4:'integer[]'};
 let legacyColumnsPreserved=0;
 for(const table of tables){
  const current=new Set((await database.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",[table])).rows.map(x=>x.column_name));
  for(const column of (backup.schema?.columns||[]).filter(x=>x.table_name===table&&!current.has(x.column_name))){
   schemaContext={table,missingColumn:column.column_name};
   assert.ok(Object.hasOwn(primitiveTypes,column.udt_name));assert.ok(!column.is_generated||column.is_generated==='NEVER');
   await database.exec(`ALTER TABLE ${identifier(table)} ADD COLUMN ${identifier(column.column_name)} ${primitiveTypes[column.udt_name]}`);legacyColumnsPreserved++;
  }
 }
 await database.exec('BEGIN;SET session_replication_role=replica');
 await database.exec(`TRUNCATE TABLE ${target.map(identifier).join(',')} RESTART IDENTITY CASCADE`);
 stage='typed-restore';let restoredRows=0;
 for(const table of tables){
  schemaContext={table};
  const columns=(await database.query("SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'",[table])).rows;
  const types=new Map(columns.map(x=>[x.column_name,x.udt_name]));
  for(const row of backup.tables[table]){
   const names=Object.keys(row);const missingColumns=names.filter(name=>!types.has(name));schemaContext={table,missingColumns};assert.equal(missingColumns.length,0);
   const values=names.map(name=>{const value=row[name],type=types.get(name);if(value===null)return null;if(['json','jsonb'].includes(type))return JSON.stringify(value);if(type==='bytea'&&value?.type==='Buffer')return Buffer.from(value.data);return value;});
   await database.query(`INSERT INTO ${identifier(table)} (${names.map(identifier).join(',')}) VALUES (${names.map((_,i)=>'$'+(i+1)).join(',')})`,values);
  }
  const count=(await database.query(`SELECT count(*)::int AS count FROM ${identifier(table)}`)).rows[0].count;
  assert.equal(count,backup.tables[table].length);restoredRows+=count;
  for(const {column_name} of columns){
   const sequence=(await database.query('SELECT pg_get_serial_sequence($1,$2) AS name',[`public.${table}`,column_name])).rows[0].name;
   if(sequence){
    const maximum=(await database.query(`SELECT max(${identifier(column_name)})::text AS value FROM ${identifier(table)}`)).rows[0].value;
    const known=maximum!==null&&BigInt(maximum)>0n;
    await database.query('SELECT setval($1::regclass,$2::bigint,$3)',[sequence,known?maximum:'1',known]);
    const next=(await database.query('SELECT nextval($1::regclass)::text AS value',[sequence])).rows[0].value;
    assert.equal(BigInt(next),known?BigInt(maximum)+1n:1n);
   }
  }
 }
 await database.exec('SET session_replication_role=origin;COMMIT');
 console.log(JSON.stringify({ok:true,inMemoryOnly:true,outboundNetworkBlocked:true,tableCount:tables.length,restoredRows,allColumnsCompatible:true,typedInserts:true,rowCountsMatch:true,sequencesResetAndChecked:true,legacyColumnsPreserved}));
}catch(error){console.log(JSON.stringify({ok:false,stage,schemaContext,code:/^[A-Z0-9_]{2,30}$/.test(error.code||'')?error.code:'ISOLATED_RESTORE_FAILED'}));process.exitCode=1;}
finally{await pool?.end();await server?.stop();await database?.close();}
