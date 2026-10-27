import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';

const mode=process.argv[2]??'local';
if(!['local','postgres'].includes(mode))throw new Error('Use local or postgres, never a deployed database.');
process.env.NODE_ENV='test';process.env.VERCEL='';process.env.DATABASE_URL='';
process.env.DATABASE_POOL_MAX='8';process.env.ADMIN_EMAIL='';process.env.SMTP_HOST='';process.env.RESEND_API_KEY='';
let temp,server,pglite,pool;
let assertions=0;
function check(condition,message){assert.ok(condition,message);assertions++;if(process.env.ASTANA_WORKSPACE_TEST_TRACE==='1')process.stderr.write(message+'\n');}
async function denied(promise,message){await assert.rejects(promise,message);assertions++;}
try{
  if(mode==='local'){
    const root=path.resolve('tmp');await mkdir(root,{recursive:true});temp=await mkdtemp(path.join(root,'job-workspace-test-'));process.env.ASTANA_LOCAL_DB_PATH=path.join(temp,'local.json');
  }else{
    const {PGlite}=await import('@electric-sql/pglite');const {PGLiteSocketServer}=await import('@electric-sql/pglite-socket');
    const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});const {port}=probe.address();await new Promise(resolve=>probe.close(resolve));
    pglite=await PGlite.create();server=new PGLiteSocketServer({db:pglite,port,host:'127.0.0.1',maxConnections:8});await server.start();process.env.DATABASE_URL=`postgres://isolated:isolated@127.0.0.1:${port}/isolated`;
  }
  const db=await import('../src/server/db.ts');const api=await import('../src/server/job-workspace-db.ts');const policy=await import('../src/server/job-workspace-policy.ts');
  if(mode==='postgres'){await db.ensureServerDatabaseSchema();pool=db.getServerDatabasePool();const {migrateJobWorkspaceSchema}=await import('../src/server/job-workspace-migration.ts');await migrateJobWorkspaceSchema(pool);await migrateJobWorkspaceSchema(pool);}
  const sa={email:'owner@example.invalid',role:'SUPER_ADMIN'},op={email:'jarka@example.invalid',role:'OPERATOR'},other={email:'slavka@example.invalid',role:'OPERATOR'},reviewer={email:'reviewer@example.invalid',role:'META_REVIEWER'};
  for(const user of [sa,op,other])await db.upsertAdminUser({email:user.email,role:user.role,active:true},sa.email);
  const pdf={id:randomUUID(),jobId:null,offerDraftId:null,storageKey:'private/isolation/original.pdf',fileName:'Ponuka.pdf',mime:'application/pdf',size:1234,sha256:'a'.repeat(64),thumbnailStorageKey:null,kind:'PDF'};
  await api.registerJobPrivateDocument(pdf,op);
  check(await api.getJobPrivateDocument(pdf.id,other)===null,'another operator cannot open pending original');
  const input={originalNumber:'JARKA 2024/007',issuedOn:null,contactPerson:'Mária Stará',email:'customer@example.invalid',phone:'0905 123 456',address:'Poprad stará stodola',jobId:null,leadId:null,items:[{id:randomUUID(),description:'Azbestová vzduchotechnika',unit:'m',quantity:null,unitPriceWithoutVatCents:null,totalWithoutVatCents:null,vatRate:null}],totalWithoutVatCents:null,totalWithVatCents:null,currency:'EUR',note:'Obhliadka starej haly',pdf:{documentId:pdf.id,sha256:pdf.sha256,originalName:pdf.fileName}};
  const imported=await api.importManualPriceOffer(input,op);
  check(imported.offer.items[0].quantity===null&&imported.offer.totalWithVatCents===null,'unknown quantities and totals stay null');
  const duplicate=await api.importManualPriceOffer({...input,originalNumber:'MUST NOT REPLACE'},op);check(duplicate.duplicate&&duplicate.offer.originalNumber===input.originalNumber,'hash dedupe never overwrites evidence');
  const collisionPdf={...pdf,id:randomUUID(),storageKey:'private/isolation/collision.pdf',sha256:'b'.repeat(64)};await api.registerJobPrivateDocument(collisionPdf,op);
  await denied(api.importManualPriceOffer({...input,pdf:{...input.pdf,documentId:collisionPdf.id,sha256:collisionPdf.sha256}},op),/Číslo/);
  const corrected=await api.updateManualPriceOffer(imported.offer.id,{expectedRevision:1,fields:{...input,pdf:undefined,originalNumber:undefined,totalWithoutVatCents:100000,totalWithVatCents:123000}},op);
  check(corrected.totalWithVatCents===123000&&corrected.history.length===1,'human correction has history');
  const sent=await api.verifyManualPriceOfferSent(corrected.id,{expectedRevision:corrected.revision,sentOn:'2026-10-20',evidence:'Overené v odoslanej pošte podľa správy 123'},op);
  await denied(api.updateManualPriceOffer(sent.id,{expectedRevision:sent.revision,fields:input},op),/koncept/);
  const accepts=await Promise.all([api.acceptManualPriceOffer(sent.id,{expectedRevision:sent.revision,responsibleEmail:other.email,acceptedOn:'2026-10-21'},op),api.acceptManualPriceOffer(sent.id,{expectedRevision:sent.revision,responsibleEmail:other.email,acceptedOn:'2026-10-21'},op)]);
  check(accepts[0].jobId===accepts[1].jobId,'concurrent acceptance links one existing UUID');const jobId=accepts[0].jobId;
  check((await db.getBusinessJob(jobId)).demolitionDate==='','acceptance does not invent demolition date');
  check((await db.getBusinessJob(jobId)).totalPrice===1230&&(await db.getBusinessJob(jobId)).totalPriceKnown!==false,'full imported total is the canonical job price without fabricated area');
  check((await api.getJobPrivateDocument(pdf.id,other)).jobId===jobId,'accepted original PDF is available to job operators');
  let card=await api.getJobWorkspace(jobId,sa);check(card.operations.responsibleEmail===other.email,'handoff has explicit owner');check(card.operations.plan.actualOn===null&&card.operations.materials.length===0,'no invented area/actual date');
  let ops=structuredClone(card.operations);ops.materials=[{id:randomUUID(),kind:'AZBESTOVE_RURY',label:'Rúry v pivnici',unit:'M',plannedQuantity:12,actualQuantity:null,plannedKg:null,actualKg:null}];ops.plan.tentativeOn='2026-11-03';ops.note='Modrá brána pri starej hale';
  const saved=await api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:ops,settlement:{...card.settlement,actualAmountWithVatCents:123000,note:'súkromná finančná poznámka'}},sa);
  check((await db.getBusinessJob(jobId)).totalPrice===1230,'saving settlement keeps the same canonical price');
  await denied(api.saveJobWorkspace(jobId,{expectedRevision:saved.revision,operations:ops,settlement:{...card.settlement,actualCostCents:999999}},sa),/náklady/);
  const operational=await api.getJobWorkspace(jobId,op);check(!Object.hasOwn(operational,'settlement')&&!JSON.stringify(operational).includes('súkromná finančná'),'operator cannot read finance or financial audit');
  await denied(api.saveJobWorkspace(jobId,{expectedRevision:saved.revision,operations:ops,settlement:policy.emptyJobWorkspaceSettlement()},op),/superadmin/);
  await denied(api.saveJobWorkspace(jobId,{expectedRevision:saved.revision,operations:{...ops,status:'DOKONCENA'}},op),/sprievodca/);
  const races=await Promise.allSettled([api.saveJobWorkspace(jobId,{expectedRevision:saved.revision,operations:{...ops,note:'A'}},op),api.saveJobWorkspace(jobId,{expectedRevision:saved.revision,operations:{...ops,note:'B'}},op)]);check(races.filter(r=>r.status==='fulfilled').length===1,'optimistic revision prevents concurrent lost update');
  card=await api.getJobWorkspace(jobId,sa);check(card.settlement.note==='súkromná finančná poznámka','operator write preserves financial state');
  for(let i=0;i<3;i++){
    const legacy=await db.getBusinessJob(jobId);const latest=await api.getJobWorkspace(jobId,sa);
    await Promise.all([api.saveJobWorkspace(jobId,{expectedRevision:latest.revision,operations:latest.operations,settlement:{...latest.settlement,actualAmountWithVatCents:140000+i*100}},sa),db.saveBusinessJob({...legacy,m2:0,pricePerM2:0},sa.email,jobId)]);
    const after=await db.getBusinessJob(jobId),authoritative=await api.getJobWorkspace(jobId,sa);check(after.totalPrice===authoritative.settlement.actualAmountWithVatCents/100,'legacy save racing the card cannot recalculate or overwrite the canonical total');
  }
  card=await api.getJobWorkspace(jobId,sa);
  await denied(api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:{...card.operations,responsibleEmail:'missing@example.invalid'}},op),/aktívny/);
  const futureOps=structuredClone(card.operations);futureOps.authorities.OU_ZP.submittedOn='2099-01-01';await denied(api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:futureOps},op),/budúcnosti/);
  const badDocument=structuredClone(card.operations);badDocument.authorities.OU_ZP.documentId=randomUUID();await denied(api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:badDocument},op),/Príloha úradu/);
  const badTime=structuredClone(card.operations);badTime.plan.timeFrom='11:00';badTime.plan.timeTo='09:00';await denied(api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:badTime},op),/Koniec práce/);
  const badCount=structuredClone(card.operations);badCount.plan.actualVehicleCount=1.5;await denied(api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:badCount},op),/celé číslo/);
  await denied(api.getJobWorkspace(jobId,reviewer),/oprávnenie/);
  ops=structuredClone(card.operations);ops.authorities.OU_ZP={...ops.authorities.OU_ZP,required:'YES',submittedOn:'2026-10-22',reference:'OÚ-001'};
  card=await api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:ops},other);
  const notice=await api.prepareAuthorityNotice(jobId,{operationId:randomUUID(),expectedRevision:card.revision},other);check(notice.snapshot.length===1&&notice.snapshot[0].authority==='OU_ZP'&&!notice.text.includes('RÚVZ:'),'notice only claims real submitted authority');
  const repeatedNotice=await api.prepareAuthorityNotice(jobId,{operationId:randomUUID(),expectedRevision:card.revision},other);check(repeatedNotice.id===notice.id,'fresh POST id cannot duplicate same submitted snapshot');
  const noticeRace=await Promise.all([api.claimAuthorityNotice(notice.id,other),api.claimAuthorityNotice(notice.id,other)]);check(noticeRace.filter(Boolean).length===1,'only one sender can claim a prepared notice');const claimed=noticeRace.find(Boolean);
  await api.finalizeAuthorityNotice(notice.id,claimed.attemptId,'UNCERTAIN',other);check(await api.claimAuthorityNotice(notice.id,other)===null,'uncertain SMTP result is never automatically retried');
  card=await api.getJobWorkspace(jobId,sa);ops=structuredClone(card.operations);ops.authorities.RUVZ={...ops.authorities.RUVZ,required:'YES',submittedOn:'2026-10-23'};card=await api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:ops},other);
  const staleNotice=await api.prepareAuthorityNotice(jobId,{operationId:randomUUID(),expectedRevision:card.revision},other);await api.saveJobWorkspace(jobId,{expectedRevision:card.revision,operations:{...ops,note:'zmena po náhľade'}},other);await denied(api.claimAuthorityNotice(staleNotice.id,other),/zmenili/);
  const refreshedCard=await api.getJobWorkspace(jobId,other),refreshed=await api.prepareAuthorityNotice(jobId,{operationId:randomUUID(),expectedRevision:refreshedCard.revision},other);check(refreshed.id===staleNotice.id&&refreshed.workspaceRevision===refreshedCard.revision,'unclaimed same-snapshot preview can be refreshed after an unrelated edit');
  check(Boolean(await api.claimAuthorityNotice(refreshed.id,other)),'refreshed preview is no longer stuck stale');
  await denied(api.appendJobCommunication({jobId,source:'MANUAL',sourceMessageId:null,occurredAt:new Date().toISOString(),subject:'Neprístupná príloha',text:'test',sender:'',recipient:'',direction:'NOTE',documentIds:[randomUUID()]},op),/Príloha/);
  const communication=await api.appendJobCommunication({jobId,source:'GMAIL',sourceMessageId:'gmail:test:message-1',occurredAt:'2024-01-05T12:00:00.000Z',subject:'Stará hala',text:'historický modrý plot',sender:input.email,recipient:sa.email,direction:'INBOUND',documentIds:[]},sa);
  const repeatedCommunication=await api.appendJobCommunication({...communication,id:undefined},sa);check(communication.id===repeatedCommunication.id,'Gmail evidence deduped by source ID');
  const search=await db.searchAdminData('maria historicky plot',false);check(search.jobs.some(j=>j.id===jobId),'multiword across name and private communication without diacritics');
  const byNumber=await db.searchAdminData('JARKA 2024/007',false);check(byNumber.jobs.some(j=>j.id===jobId)&&byNumber.offers.some(o=>o.id===sent.id),'original CP number locates offer and job');
  check(search.finance.length===0,'operator search contains no financial results');
  check((await db.searchAdminData('maria rury',false)).jobs.some(job=>job.id===jobId),'search includes newly recorded operational materials across fields');
  const calendar=await api.listJobWorkspaceOperationalSummaries(op,{from:'2026-11-01',to:'2026-11-30'});check(calendar.some(c=>c.jobId===jobId)&&!JSON.stringify(calendar).includes('settlement'),'planner bulk projection contains no finance');
  // Search must expose results after the old 20-row cutoff, including older archived work.
  const jobTemplate=await db.getBusinessJob(jobId);for(let i=0;i<27;i++)await db.saveBusinessJob({...jobTemplate,customerName:`Paging osoba ${i}`,demolitionDate:'2024-04-01',note:'stránkovanie',status:'DOPYT'},sa.email);
  const page2=await db.searchAdminData('Paging osoba',false,{page:2,pageSize:20});check(page2.jobs.length===7&&page2.pagination.totals.jobs===27,'true pagination reaches older records beyond20');
  const noYear=await db.searchAdminData('Paging osoba',false,{year:1999});check(noYear.jobs.length===0,'year filter is applied');
  const historical=await db.searchAdminData('Paging osoba',false,{year:2024});check(historical.pagination.totals.jobs===27,'historical work is filtered by work date rather than registration year');
  const acceptedSearch=await db.searchAdminData('JARKA 2024/007',false,{status:'PRIJATA'});check(acceptedSearch.offers.some(o=>o.id===sent.id),'shared CP status filters map imported accepted offers');
  const unknownPdf={...pdf,id:randomUUID(),sha256:'c'.repeat(64),storageKey:'private/isolation/unknown.pdf'};await api.registerJobPrivateDocument(unknownPdf,op);
  const unknown=await api.importManualPriceOffer({...input,originalNumber:'UNKNOWN/001',pdf:{documentId:unknownPdf.id,sha256:unknownPdf.sha256,originalName:unknownPdf.fileName}},op);
  const unknownSent=await api.verifyManualPriceOfferSent(unknown.offer.id,{expectedRevision:unknown.offer.revision,sentOn:'2026-10-20',evidence:'Overené odoslanie bez vyčíslenej ceny'},op);
  const unknownAccepted=await api.acceptManualPriceOffer(unknownSent.id,{expectedRevision:unknownSent.revision,responsibleEmail:other.email,acceptedOn:'2026-10-21'},op);
  check((await db.getBusinessJob(unknownAccepted.jobId)).totalPriceKnown===false,'unknown imported price remains explicitly unknown in canonical projection');
  check((await db.getBusinessJobsSummary()).unknownPriceCount>=1,'financial summary counts unknown prices separately');
  const existingParent=await db.saveBusinessJob({...jobTemplate,customerName:'Existujúci klient',demolitionDate:'2024-05-01',m2:10,pricePerM2:10,status:'DOPYT'},sa.email);
  const existingCard=await api.getJobWorkspace(existingParent.id,op);await api.saveJobWorkspace(existingParent.id,{expectedRevision:existingCard.revision,operations:existingCard.operations},op);
  const existingPdf={...pdf,id:randomUUID(),sha256:'d'.repeat(64),storageKey:'private/isolation/existing.pdf'};await api.registerJobPrivateDocument(existingPdf,op);
  const existingOffer=await api.importManualPriceOffer({...input,jobId:existingParent.id,originalNumber:'EXISTING/001',totalWithoutVatCents:100000,totalWithVatCents:123000,pdf:{documentId:existingPdf.id,sha256:existingPdf.sha256,originalName:existingPdf.fileName}},op);
  const existingSent=await api.verifyManualPriceOfferSent(existingOffer.offer.id,{expectedRevision:existingOffer.offer.revision,sentOn:'2026-10-20',evidence:'Overené odoslanie k existujúcej zákazke'},op);await api.acceptManualPriceOffer(existingSent.id,{expectedRevision:existingSent.revision,responsibleEmail:other.email,acceptedOn:'2026-10-21'},op);
  const existingAfter=await db.getBusinessJob(existingParent.id),existingAfterCard=await api.getJobWorkspace(existingParent.id,sa);check(existingAfter.status==='PONUKA_POTVRDENA'&&existingAfter.totalPrice===1230&&existingAfterCard.priceOverride===true,'accepting an import into an existing card advances the parent and adopts the first verified total');
  const cancelledParent=await db.saveBusinessJob({...jobTemplate,customerName:'Zrušený klient',demolitionDate:'2024-05-01',status:'ZRUSENA'},sa.email);
  const cancelledPdf={...pdf,id:randomUUID(),sha256:'e'.repeat(64),storageKey:'private/isolation/cancelled.pdf'};await api.registerJobPrivateDocument(cancelledPdf,op);
  const cancelledOffer=await api.importManualPriceOffer({...input,jobId:cancelledParent.id,originalNumber:'CANCELLED/001',pdf:{documentId:cancelledPdf.id,sha256:cancelledPdf.sha256,originalName:cancelledPdf.fileName}},op);
  const cancelledSent=await api.verifyManualPriceOfferSent(cancelledOffer.offer.id,{expectedRevision:cancelledOffer.offer.revision,sentOn:'2026-10-20',evidence:'Overené historické odoslanie zákazníkovi'},op);await denied(api.acceptManualPriceOffer(cancelledSent.id,{expectedRevision:cancelledSent.revision,responsibleEmail:other.email,acceptedOn:'2026-10-21'},op),/Zrušenú/);
  const unknownCard=await api.getJobWorkspace(unknownAccepted.jobId,sa);await api.saveJobWorkspace(unknownAccepted.jobId,{expectedRevision:unknownCard.revision,operations:{...unknownCard.operations,status:'DEMONT_DOKONCENA'}},op);
  const completion=await db.saveBusinessJobCompletion({jobId:unknownAccepted.jobId,expectedRevision:0,actorEmail:sa.email,actorRole:sa.role,values:{documentsDecision:'confirmed',documentsReason:'',costsDecision:'confirmed_zero',costsReason:'Potvrdené nulové externé náklady',photosDecision:'not_available',photosReason:'Zákazník fotografie neposkytol',reviewDecision:'blocked',reviewBlockReason:'Cena ešte nie je doplnená'}});
  await denied(db.finalizeBusinessJobCompletion({jobId:unknownAccepted.jobId,expectedRevision:completion.revision,actorEmail:sa.email,actorRole:sa.role}),/celkovú cenu/);
  const generated=await db.savePriceOffer({objectType:'Dom',objectAddress:'Generovaná 1',municipality:'Poprad',district:'Poprad',contactPerson:'Generovaný klient',phone:'0900000001',email:'generated@example.invalid',realizationTerm:'',materialType:'VLNITY_ETERNIT',areaM2:20,pricePerM2WithoutVat:10,documentationFeeWithoutVat:99,includeDocumentation:true,documentationPromotion:false,includeTransport:false,transportFrom:'',transportTo:'',transportRoundTripKm:0,transportPricePerKm:0,validUntil:'2027-12-31'},sa.email);
  await db.confirmPreparedPriceOffersSentExternally([{id:generated.id,sentAt:new Date().toISOString(),evidenceCode:'sent_folder_verified'}],sa.email);
  const generatedAccepts=await Promise.all([db.updatePriceOfferStatus(generated.id,'PRIJATA',sa.email),db.updatePriceOfferStatus(generated.id,'PRIJATA',sa.email)]);const generatedAfter=await db.getPriceOffer(generated.id);
  check(Boolean(generatedAfter.jobId)&&generatedAccepts.filter(Boolean).length===1,'generated quote acceptance also creates exactly one linked job');
  const generatedJob=await db.getBusinessJob(generatedAfter.jobId);check(generatedJob.demolitionDate===''&&generatedJob.totalPrice===generated.totalWithVat,'generated acceptance preserves documentation fees and unknown work date');
  const dateJob=await db.saveBusinessJob({...jobTemplate,customerName:'Dátumová konzistencia',demolitionDate:'',status:'DOPYT'},sa.email);
  let dateCard=await api.getJobWorkspace(dateJob.id,op);dateCard=await api.saveJobWorkspace(dateJob.id,{expectedRevision:dateCard.revision,operations:{...dateCard.operations,plan:{...dateCard.operations.plan,tentativeOn:'2027-06-01',agreedOn:'2027-06-02'}}},op);
  check((await db.getBusinessJob(dateJob.id)).demolitionDate===''&&dateCard.operations.plan.actualOn===null,'tentative and agreed days never become legacy actual days');
  dateCard=await api.saveJobWorkspace(dateJob.id,{expectedRevision:dateCard.revision,operations:{...dateCard.operations,status:'DEMONT_DOKONCENA',plan:{...dateCard.operations.plan,actualOn:'2024-07-11'}}},op);
  check((await db.getBusinessJob(dateJob.id)).demolitionDate==='2024-07-11'&&(await db.getOperationalBusinessJobWithActivity(dateJob.id)).actualDateOverridden===true,'explicit actual day atomically reaches safe legacy projections');
  check((await db.countBusinessJobs({from:'2024-07-11',to:'2024-07-11'}))===1,'actual day is available to existing annual date filtering');
  const dateLegacy=await db.getBusinessJob(dateJob.id);await db.saveBusinessJob({...dateLegacy,demolitionDate:'2023-01-01'},sa.email,dateJob.id);await db.updateBusinessJobOperational(dateJob.id,{...dateLegacy,demolitionDate:'2022-01-01'},op.email);
  check((await db.getBusinessJob(dateJob.id)).demolitionDate==='2024-07-11'&&(await api.getJobWorkspace(dateJob.id,op)).operations.plan.actualOn==='2024-07-11','legacy SA and operator edits cannot overwrite the managed actual day');
  dateCard=await api.getJobWorkspace(dateJob.id,op);await Promise.all([api.saveJobWorkspace(dateJob.id,{expectedRevision:dateCard.revision,operations:{...dateCard.operations,plan:{...dateCard.operations.plan,actualOn:'2024-07-12'}}},op),db.saveBusinessJob({...dateLegacy,demolitionDate:'2021-01-01'},sa.email,dateJob.id)]);
  check((await db.getBusinessJob(dateJob.id)).demolitionDate==='2024-07-12','legacy and actual-day concurrent writes retain one actual-day authority');
  dateCard=await api.getJobWorkspace(dateJob.id,op);dateCard=await api.saveJobWorkspace(dateJob.id,{expectedRevision:dateCard.revision,operations:{...dateCard.operations,plan:{...dateCard.operations.plan,actualOn:null}}},op);
  check((await db.getBusinessJob(dateJob.id)).demolitionDate===''&&dateCard.timeline.some(event=>event.action==='operations.actual_day_changed'&&event.changes.cleared===true),'explicit clearing is audited and clears the legacy actual day');
  await db.saveBusinessJob({...dateLegacy,demolitionDate:'2024-07-12'},sa.email,dateJob.id);check((await db.getBusinessJob(dateJob.id)).demolitionDate===''&&(await db.countBusinessJobs({from:'2024-07-12',to:'2024-07-12'}))===0,'stale legacy forms cannot resurrect an explicitly cleared day');
  const historicalJob=await db.saveBusinessJob({...jobTemplate,customerName:'Historický skutočný deň',demolitionDate:'2023-09-05',status:'DEMONT_DOKONCENA'},sa.email);
  let historicalCard=await api.getJobWorkspace(historicalJob.id,op);check(historicalCard.operations.plan.actualOn==='2023-09-05','completed historical actual day is visible without inventing a new date');
  historicalCard=await api.saveJobWorkspace(historicalJob.id,{expectedRevision:historicalCard.revision,operations:{...historicalCard.operations,note:'Iba poznámka'}},op);check((await db.getBusinessJob(historicalJob.id)).demolitionDate==='2023-09-05'&&!historicalCard.actualDateOverride,'an unrelated card save preserves the historical legacy day');
  await db.updateBusinessJobOperational(historicalJob.id,{...historicalJob,demolitionDate:'2023-09-06'},op.email);const editedHistorical=await api.getJobWorkspace(historicalJob.id,op);check(editedHistorical.operations.plan.actualOn==='2023-09-06'&&editedHistorical.revision>historicalCard.revision,'legacy historical-date edits update the card and its revision atomically');
  await denied(api.saveJobWorkspace(historicalJob.id,{expectedRevision:historicalCard.revision,operations:historicalCard.operations},op),/medzitým/);
  const privateEvidence=async()=>JSON.stringify({offer:await api.getManualPriceOffer(sent.id,sa),documents:await api.listJobPrivateDocuments(jobId,sa),communications:await api.listJobCommunications(jobId,sa),notices:await api.listAuthorityNotices(jobId,sa),card:await api.getJobWorkspace(jobId,sa)});
  const beforeDelete=await privateEvidence();await denied(db.destroyBusinessJob(jobId,sa.email),/archiváciu/);
  await db.deleteBusinessJob(jobId,sa.email);check(Boolean((await db.getBusinessJob(jobId,true)).deletedAt),'job with private evidence can be safely archived');
  await denied(db.destroyBusinessJob(jobId,sa.email),/archiváciu/);check((await privateEvidence())===beforeDelete,'hard-delete guard retains all original PDF, message, notice and card records without local orphans');
  const cleanJob=await db.saveBusinessJob({...jobTemplate,customerName:'Prázdny skúšobný záznam',demolitionDate:'2024-06-01',status:'DOPYT'},sa.email);await db.destroyBusinessJob(cleanJob.id,sa.email);check(await db.getBusinessJob(cleanJob.id,true)===null,'a job without financial or new private evidence remains removable');
  if(mode==='local'){const raw=JSON.parse(await readFile(process.env.ASTANA_LOCAL_DB_PATH,'utf8'));check(raw.leadEmailOutbox.length===0&&raw.metaCapiOutbox.length===0,'internal workspace has no email/marketing side effects');}
  else {check(Number((await pool.query('SELECT count(*) AS n FROM lead_email_outbox')).rows[0].n)===0,'no mail queued');check(Number((await pool.query('SELECT count(*) AS n FROM job_workspace_manual_offers')).rows[0].n)===4,'one canonical record per distinct manual offer');}
  process.stdout.write(JSON.stringify({mode,status:'PASS',assertions,isolated:true,emailsSent:0,productionTouched:false})+'\n');
}finally{
  if(pool)await pool.end();if(server)await server.stop();if(pglite)await pglite.close();
  if(temp){const resolved=path.resolve(temp),root=path.resolve('tmp')+path.sep;if(!resolved.startsWith(root))throw new Error('Refusing unsafe cleanup.');await rm(resolved,{recursive:true,force:true});}
}
