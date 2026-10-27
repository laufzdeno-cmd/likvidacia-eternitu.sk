import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { getServerDatabasePool, readJobWorkspaceLocalState, readJobWorkspaceFinancialSource, withJobWorkspaceLocalTransaction } from './db';
import type { BusinessJob } from './types';
import type { AuthorityNotice, FinancialJobWorkspaceCard, JobCommunication, JobCommunicationInput, JobPrivateDocument, JobWorkspaceActor, JobWorkspacePatch, ManualOfferImportResult, ManualPriceOffer, ManualPriceOfferInput } from './job-workspace-types';
import { assertJobWorkspaceActor, emptyJobWorkspaceOperations, emptyJobWorkspaceSettlement, jobWorkspaceOperationsSchema, jobWorkspaceSettlementSchema, nullableJobDateSchema, projectJobWorkspace, inheritLegacyActualDate, workspaceCalendarDay } from './job-workspace-policy';
const uuid = (id: string) => z.uuid().parse(id);
const iso = () => new Date().toISOString();
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(new Date());
const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string {
    const ordered = (item: unknown): unknown => Array.isArray(item) ? item.map(ordered) : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, ordered(child)])) : item;
    return JSON.stringify(ordered(value));
}
const numberKey = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('sk').replace(/\s+/g, ' ');
async function assertAssignableUser(email: string, client?: PoolClient) {
    if (!email)
        return;
    const db = client ?? getServerDatabasePool();
    const user = db ? (await db.query('SELECT email,active,role FROM admin_users WHERE lower(email)=lower($1)', [email])).rows[0] : (await readJobWorkspaceLocalState()).assignableUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
    if (!user?.active || !['OPERATOR', 'SUPER_ADMIN'].includes(user.role))
        throw new Error('Zodpovedná osoba musí byť aktívny operátor alebo superadmin.');
}
const conflict = () => new Error('Karta sa medzitým zmenila. Obnovte ju a skontrolujte zmeny.');
function validateCompletionTransition(previous: string, next: string) {
    if (previous !== next && (previous === 'DOKONCENA' || next === 'DOKONCENA'))
        throw new Error('Dokončenie alebo znovuotvorenie vyžaduje existujúci kontrolný sprievodca.');
}
function acceptedJobStatus(status: BusinessJob['status']): BusinessJob['status'] {
    if (status === 'ZRUSENA')
        throw new Error('Zrušenú zákazku treba najprv kontrolovane znovu otvoriť.');
    return ['DOPYT', 'DOPYT_PRIJATY', 'PONUKA_ODOSLANA', 'PRIJATA'].includes(status) ? 'PONUKA_POTVRDENA' : status;
}
function acceptedOfferCard(current: FinancialJobWorkspaceCard, offer: ManualPriceOffer, status: BusinessJob['status'], responsibleEmail: string, actor: JobWorkspaceActor) {
    const next = changedCard(current, { expectedRevision: current.revision, operations: { ...current.operations, status, responsibleEmail: current.operations.responsibleEmail || responsibleEmail } }, actor);
    if (!current.priceOverride) {
        next.priceOverride = true;
        next.settlement = { ...current.settlement, agreedAmountWithVatCents: offer.totalWithVatCents };
        next.timeline.push({
            id: randomUUID(), jobId: current.jobId, revision: next.revision, actorEmail: actor.email, recordedAt: next.updatedAt, action: 'offer.accepted.price', visibility: 'FINANCE', changes: { offerId: offer.id, agreedAmountWithVatCents: offer.totalWithVatCents }
        });
    }
    return next;
}
const nonnegativeCents = z.number().int().min(0).max(1000000000000).nullable();
const manualInputSchema = z.object({
    originalNumber: z.string().trim().min(1).max(120), issuedOn: nullableJobDateSchema, contactPerson: z.string().trim().min(1).max(300), email: z.union([z.email(), z.literal('')]), phone: z.string().trim().max(100), address: z.string().trim().max(1000), jobId: z.uuid().nullable().optional(), leadId: z.uuid().nullable().optional(), items: z.array(z.object({
        id: z.uuid(), description: z.string().trim().min(1).max(1000), unit: z.string().trim().max(30), quantity: z.number().finite().min(0).nullable(), unitPriceWithoutVatCents: nonnegativeCents, totalWithoutVatCents: nonnegativeCents, vatRate: z.number().min(0).max(100).nullable()
    }).strict()).max(200), totalWithoutVatCents: nonnegativeCents, totalWithVatCents: nonnegativeCents, currency: z.literal('EUR'), note: z.string().trim().max(10000), pdf: z.object({ documentId: z.uuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/), originalName: z.string().min(1).max(300) }).strict(), sourceMessageId: z.string().trim().max(500).nullable().optional()
}).strict();
async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = getServerDatabasePool();
    if (!pool)
        throw new Error('PostgreSQL nie je nastavené.');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await operation(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    }
    finally {
        client.release();
    }
}
function blankCard(jobId: string, job?: Pick<BusinessJob, 'createdAt' | 'status' | 'workType'> & Partial<Pick<BusinessJob, 'demolitionDate'>>): FinancialJobWorkspaceCard {
    const card: FinancialJobWorkspaceCard = {
        jobId, number: `ZAK-${(job?.createdAt || iso()).slice(0, 4)}-${jobId.replace(/-/g, '').slice(0, 12).toUpperCase()}`, revision: 0, createdAt: job?.createdAt || '', updatedAt: '', updatedBy: '', operations: emptyJobWorkspaceOperations(job), settlement: emptyJobWorkspaceSettlement(), timeline: []
    };
    if (job)
        inheritLegacyActualDate(card, job.demolitionDate, job.status);
    return card;
}
async function projectWithRecordedCosts(card: FinancialJobWorkspaceCard, actor: JobWorkspaceActor, client?: PoolClient) {
    const projected = clone(card);
    if (actor.role === 'SUPER_ADMIN')
        projected.settlement.actualCostCents = (await readJobWorkspaceFinancialSource(card.jobId, client)).recordedCostCents;
    return projectJobWorkspace(projected, actor);
}
function fromRow(row: Record<string, unknown>, financial = true): FinancialJobWorkspaceCard {
    return {
        jobId: String(row.job_id), number: String(row.number), revision: Number(row.revision), createdAt: new Date(String(row.created_at)).toISOString(), updatedAt: new Date(String(row.updated_at)).toISOString(), updatedBy: String(row.updated_by), priceOverride: Boolean(row.price_override), actualDateOverride: Boolean(row.actual_date_override), operations: row.operations as FinancialJobWorkspaceCard['operations'], settlement: financial ? row.settlement as FinancialJobWorkspaceCard['settlement'] : emptyJobWorkspaceSettlement(), timeline: (row.timeline ?? []) as FinancialJobWorkspaceCard['timeline']
    };
}
function changedCard(current: FinancialJobWorkspaceCard, patch: JobWorkspacePatch, actor: JobWorkspaceActor): FinancialJobWorkspaceCard {
    if (!Number.isInteger(patch.expectedRevision) || patch.expectedRevision !== current.revision)
        throw conflict();
    if (actor.role !== 'SUPER_ADMIN' && patch.settlement !== undefined)
        throw new Error('Finančné údaje môže meniť iba superadmin.');
    const operations = jobWorkspaceOperationsSchema.parse(patch.operations);
    if (current.operations.plan.agreedOn && current.operations.plan.agreedOn !== operations.plan.agreedOn && operations.plan.rescheduleReason.trim().length < 3)
        throw new Error('Pri presune dohodnutého termínu doplňte dôvod.');
    const settlement = patch.settlement ? jobWorkspaceSettlementSchema.parse(patch.settlement) : current.settlement;
    const timestamp = iso(), revision = current.revision + 1;
    const actualChanged = current.operations.plan.actualOn !== operations.plan.actualOn;
    const timeline = [...current.timeline];
    for (const [key, next] of Object.entries(operations))
        if (canonical(current.operations[key as keyof typeof operations]) !== canonical(next))
            timeline.push({
                id: randomUUID(), jobId: current.jobId, revision, actorEmail: actor.email, recordedAt: timestamp, action: `operations.${key}`, visibility: 'OPERATIONS', changes: { before: current.operations[key as keyof typeof operations], after: next }
            });
    if (actualChanged)
        timeline.push({
            id: randomUUID(), jobId: current.jobId, revision, actorEmail: actor.email, recordedAt: timestamp, action: 'operations.actual_day_changed', visibility: 'OPERATIONS', changes: {
                before: current.operations.plan.actualOn, after: operations.plan.actualOn, cleared: operations.plan.actualOn === null, source: 'workspace'
            }
        });
    if (canonical(settlement) !== canonical(current.settlement))
        timeline.push({
            id: randomUUID(), jobId: current.jobId, revision, actorEmail: actor.email, recordedAt: timestamp, action: 'settlement.updated', visibility: 'FINANCE', changes: { before: current.settlement, after: settlement }
        });
    return {
        ...current, actualDateOverride: Boolean(current.actualDateOverride || actualChanged), priceOverride: Boolean(current.priceOverride || settlement.actualAmountWithVatCents !== null || settlement.agreedAmountWithVatCents !== null), revision, createdAt: current.createdAt || timestamp, updatedAt: timestamp, updatedBy: actor.email, operations, settlement, timeline
    };
}
async function persistCard(client: PoolClient, card: FinancialJobWorkspaceCard, expectedRevision: number, writeSettlement = true) {
    const result = await client.query(`INSERT INTO job_workspaces(job_id,number,revision,operations,settlement,timeline,created_at,updated_at,updated_by,price_override,actual_date_override) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$12,$13)
    ON CONFLICT(job_id) DO UPDATE SET revision=EXCLUDED.revision,operations=EXCLUDED.operations,actual_date_override=EXCLUDED.actual_date_override,settlement=CASE WHEN $11 THEN EXCLUDED.settlement ELSE job_workspaces.settlement END,price_override=CASE WHEN $11 THEN EXCLUDED.price_override ELSE job_workspaces.price_override END,timeline=CASE WHEN $11 THEN EXCLUDED.timeline ELSE COALESCE((SELECT jsonb_agg(event) FROM jsonb_array_elements(job_workspaces.timeline) event WHERE event->>'visibility'='FINANCE'),'[]'::jsonb) || EXCLUDED.timeline END,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by WHERE job_workspaces.revision=$10 RETURNING job_id`, [card.jobId, card.number, card.revision, card.operations, card.settlement, JSON.stringify(card.timeline), card.createdAt, card.updatedAt, card.updatedBy, expectedRevision, writeSettlement, Boolean(card.priceOverride), Boolean(card.actualDateOverride)]);
    if (result.rowCount !== 1)
        throw conflict();
}
function authorityDocumentIds(patch: JobWorkspacePatch) {
    return [...new Set(Object.values(patch.operations.authorities).flatMap(authority => authority.documentId ? [authority.documentId] : []))];
}
function validateAuthorityDocuments(ids: string[], documents: JobPrivateDocument[], jobId: string) {
    for (const id of ids) {
        if (!documents.some(document => document.id === id && document.jobId === jobId))
            throw new Error('Príloha úradu musí existovať a patriť tejto zákazke.');
    }
}
export async function getJobWorkspace(jobId: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(jobId);
    const db = getServerDatabasePool();
    if (!db) {
        const local = await readJobWorkspaceLocalState();
        const job = local.businessJobs.find(j => j.id === jobId);
        if (!job)
            throw new Error('Zákazka neexistuje.');
        const card = clone(local.jobWorkspace.cards.find(c => c.jobId === jobId) ?? blankCard(jobId, job));
        inheritLegacyActualDate(card, job.demolitionDate, job.status);
        card.operations.status = job.status;
        card.operations.workType = job.workType;
        return projectWithRecordedCosts(card, actor);
    }
    const result = await db.query(`SELECT job_id,number,revision,price_override,actual_date_override,operations,${actor.role === 'SUPER_ADMIN' ? 'settlement,' : ''} CASE WHEN $2 THEN timeline ELSE COALESCE((SELECT jsonb_agg(event) FROM jsonb_array_elements(timeline) event WHERE event->>'visibility'='OPERATIONS'),'[]'::jsonb) END AS timeline,created_at,updated_at,updated_by FROM job_workspaces WHERE job_id=$1`, [jobId, actor.role === 'SUPER_ADMIN']);
    if (result.rows[0]) {
        const parent = (await db.query('SELECT status,work_type,demolition_date FROM business_jobs WHERE id=$1', [jobId])).rows[0];
        if (!parent)
            throw new Error('Zákazka neexistuje.');
        const card = fromRow(result.rows[0], actor.role === 'SUPER_ADMIN');
        inheritLegacyActualDate(card, parent.demolition_date, parent.status);
        card.operations.status = parent.status;
        card.operations.workType = parent.work_type;
        return projectWithRecordedCosts(card, actor);
    }
    const parent = await db.query('SELECT created_at,status,work_type,demolition_date FROM business_jobs WHERE id=$1', [jobId]);
    if (!parent.rows[0])
        throw new Error('Zákazka neexistuje.');
    return projectWithRecordedCosts(blankCard(jobId, {
        createdAt: new Date(parent.rows[0].created_at).toISOString(), status: parent.rows[0].status, workType: parent.rows[0].work_type, demolitionDate: workspaceCalendarDay(parent.rows[0].demolition_date)
    }), actor);
}
export async function saveJobWorkspace(jobId: string, patch: JobWorkspacePatch, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(jobId);
    if (actor.role !== 'SUPER_ADMIN' && patch.settlement !== undefined)
        throw new Error('Finančné údaje môže meniť iba superadmin.');
    if (patch.settlement) {
        const recorded = (await readJobWorkspaceFinancialSource(jobId)).recordedCostCents;
        if (patch.settlement.actualCostCents !== null && patch.settlement.actualCostCents !== recorded)
            throw new Error('Skutočné náklady sa odvodzujú z evidovaných nákladov a odmien. Upravte ich v pôvodnej evidencii.');
        patch = { ...patch, settlement: { ...patch.settlement, actualCostCents: recorded } };
    }
    await assertAssignableUser(patch.operations.responsibleEmail);
    const db = getServerDatabasePool();
    if (!db)
        return withJobWorkspaceLocalTransaction(local => {
            const job = local.businessJobs.find(j => j.id === jobId && !j.deletedAt);
            if (!job)
                throw new Error('Zákazka neexistuje alebo je archivovaná.');
            validateAuthorityDocuments(authorityDocumentIds(patch), local.jobWorkspace.documents, jobId);
            validateCompletionTransition(job.status, patch.operations.status);
            const at = local.jobWorkspace.cards.findIndex(c => c.jobId === jobId), current = at >= 0 ? local.jobWorkspace.cards[at] : blankCard(jobId, job);
            inheritLegacyActualDate(current, job.demolitionDate, job.status);
            const next = changedCard(current, patch, actor);
            if (next.priceOverride && actor.role === 'SUPER_ADMIN') {
                const amount = next.settlement.actualAmountWithVatCents ?? next.settlement.agreedAmountWithVatCents;
                job.totalPrice = amount === null ? 0 : amount / 100;
                job.totalPriceKnown = amount !== null;
                job.priceOverridden = true;
                job.grossProfit = amount === null ? 0 : job.totalPrice - job.costs.total - job.rewardsTotal;
                job.marginPercent = job.totalPrice ? Math.round(job.grossProfit / job.totalPrice * 1000) / 10 : 0;
            }
            if (at < 0)
                local.jobWorkspace.cards.push(next);
            else
                local.jobWorkspace.cards[at] = next;
            if (next.actualDateOverride) {
                job.demolitionDate = next.operations.plan.actualOn ?? '';
                job.actualDateOverridden = true;
            }
            job.status = next.operations.status;
            job.workType = next.operations.workType;
            job.updatedAt = next.updatedAt;
            local.auditLogs.push({
                id: randomUUID(), entityType: 'business_job', entityId: jobId, action: 'business_job_updated', actorEmail: actor.email, createdAt: next.updatedAt, changes: { scope: 'workspace', revision: next.revision }
            });
            return projectWithRecordedCosts(next, actor);
        });
    return transaction(async (client) => {
        const parent = await client.query('SELECT created_at,status,work_type,demolition_date FROM business_jobs WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [jobId]);
        if (!parent.rows[0])
            throw new Error('Zákazka neexistuje alebo je archivovaná.');
        const ids = authorityDocumentIds(patch);
        if (ids.length) {
            const documents = await client.query('SELECT data FROM job_workspace_documents WHERE id=ANY($1::uuid[])', [ids]);
            validateAuthorityDocuments(ids, documents.rows.map(row => row.data), jobId);
        }
        validateCompletionTransition(parent.rows[0].status, patch.operations.status);
        const row = await client.query(`SELECT job_id,number,revision,price_override,actual_date_override,operations,${actor.role === 'SUPER_ADMIN' ? 'settlement,timeline,' : "COALESCE((SELECT jsonb_agg(event) FROM jsonb_array_elements(timeline) event WHERE event->>'visibility'='OPERATIONS'),'[]'::jsonb) AS timeline,"}created_at,updated_at,updated_by FROM job_workspaces WHERE job_id=$1 FOR UPDATE`, [jobId]);
        const current = row.rows[0] ? fromRow(row.rows[0], actor.role === 'SUPER_ADMIN') : blankCard(jobId, {
            createdAt: new Date(parent.rows[0].created_at).toISOString(), status: parent.rows[0].status, workType: parent.rows[0].work_type, demolitionDate: workspaceCalendarDay(parent.rows[0].demolition_date)
        });
        inheritLegacyActualDate(current, parent.rows[0].demolition_date, parent.rows[0].status);
        const next = changedCard(current, patch, actor);
        await persistCard(client, next, current.revision, actor.role === 'SUPER_ADMIN');
        if (next.priceOverride && actor.role === 'SUPER_ADMIN') {
            const amount = next.settlement.actualAmountWithVatCents ?? next.settlement.agreedAmountWithVatCents;
            await client.query('UPDATE business_jobs SET total_price=$2,total_price_overridden=true WHERE id=$1', [jobId, amount === null ? null : amount / 100]);
        }
        await client.query('UPDATE business_jobs SET status=$2,updated_at=$3,work_type=$4,demolition_date=CASE WHEN $5 THEN $6::date ELSE demolition_date END,actual_date_overridden=CASE WHEN $5 THEN true ELSE actual_date_overridden END WHERE id=$1', [jobId, next.operations.status, next.updatedAt, next.operations.workType, Boolean(next.actualDateOverride), next.operations.plan.actualOn]);
        await client.query("INSERT INTO audit_logs(id,entity_type,entity_id,action,actor_email,changes,created_at) VALUES($1,'business_job',$2,'business_job_updated',$3,$4,$5)", [randomUUID(), jobId, actor.email, { scope: 'workspace', revision: next.revision }, next.updatedAt]);
        return projectWithRecordedCosts(next, actor, client);
    });
}
export async function listManualPriceOffers(actor: JobWorkspaceActor, options: {
    jobId?: string;
    archived?: boolean;
} = {}) {
    assertJobWorkspaceActor(actor);
    if (options.jobId)
        uuid(options.jobId);
    const db = getServerDatabasePool();
    if (!db) {
        const { jobWorkspace } = await readJobWorkspaceLocalState();
        return clone(jobWorkspace.manualOffers.filter(o => (!options.jobId || o.jobId === options.jobId) && (options.archived || !o.archivedAt)));
    }
    const result = await db.query(`SELECT data FROM job_workspace_manual_offers WHERE ($1::uuid IS NULL OR job_id=$1) AND ($2 OR data->>'archivedAt' IS NULL) ORDER BY data->>'createdAt' DESC`, [options.jobId ?? null, Boolean(options.archived)]);
    return result.rows.map(r => r.data as ManualPriceOffer);
}
export async function getManualPriceOffer(id: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(id);
    const db = getServerDatabasePool();
    if (!db) {
        const local = await readJobWorkspaceLocalState();
        return clone(local.jobWorkspace.manualOffers.find(o => o.id === id) ?? null);
    }
    const result = await db.query('SELECT data FROM job_workspace_manual_offers WHERE id=$1', [id]);
    return (result.rows[0]?.data as ManualPriceOffer) ?? null;
}
function assertPdf(document: JobPrivateDocument | null, input: ManualPriceOfferInput, actor: JobWorkspaceActor) {
    if (!document || document.sha256 !== input.pdf.sha256 || document.mime !== 'application/pdf' || (document.jobId !== null && document.jobId !== (input.jobId ?? null)) || (document.jobId === null && document.createdBy !== actor.email && actor.role !== 'SUPER_ADMIN'))
        throw new Error('Originál PDF nie je dostupný alebo nesúhlasí jeho kontrolný odtlačok.');
}
function duplicateOffer(offers: ManualPriceOffer[], input: ManualPriceOfferInput) {
    const sameHash = offers.find(o => o.pdf.sha256 === input.pdf.sha256);
    if (sameHash)
        return sameHash;
    const same = offers.find(o => numberKey(o.originalNumber) === numberKey(input.originalNumber) || Boolean(input.sourceMessageId && o.sourceMessageId === input.sourceMessageId));
    if (same)
        throw new Error('Číslo ponuky alebo email už patrí inému originálu. Pripojte ho ako kontrolovanú revíziu, nič sa neprepísalo.');
    return null;
}
export async function importManualPriceOffer(raw: ManualPriceOfferInput, actor: JobWorkspaceActor): Promise<ManualOfferImportResult> {
    assertJobWorkspaceActor(actor);
    const input = manualInputSchema.parse(raw), timestamp = iso();
    const offer: ManualPriceOffer = {
        ...input, id: randomUUID(), revision: 1, source: 'MANUAL_PDF', status: 'DRAFT', createdAt: timestamp, createdBy: actor.email, updatedAt: timestamp, sentOn: null, sentEvidence: '', acceptedOn: null, acceptedBy: null, archivedAt: null
    };
    const db = getServerDatabasePool();
    if (!db)
        return withJobWorkspaceLocalTransaction(local => {
            assertPdf(local.jobWorkspace.documents.find(d => d.id === input.pdf.documentId) ?? null, input, actor);
            const duplicate = duplicateOffer(local.jobWorkspace.manualOffers, input);
            if (duplicate)
                return { offer: clone(duplicate), duplicate: true };
            if (local.priceOffers.some(o => numberKey(o.number) === numberKey(input.originalNumber)))
                throw new Error('Číslo už používa existujúca ponuka.');
            if (input.jobId && !local.businessJobs.some(j => j.id === input.jobId && !j.deletedAt))
                throw new Error('Zákazka nie je dostupná.');
            local.jobWorkspace.manualOffers.push(offer);
            return { offer: clone(offer), duplicate: false };
        });
    return transaction(async (client) => {
        if (/^\d{8}$/.test(input.originalNumber))
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`price-offer-number:${input.originalNumber.slice(0, 4)}`]);
        await client.query('LOCK TABLE job_workspace_manual_offers IN SHARE ROW EXCLUSIVE MODE');
        const document = await client.query('SELECT data FROM job_workspace_documents WHERE id=$1', [input.pdf.documentId]);
        assertPdf(document.rows[0]?.data ?? null, input, actor);
        const rows = await client.query('SELECT data FROM job_workspace_manual_offers WHERE file_sha256=$1 OR original_number_key=$2 OR ($3::text IS NOT NULL AND source_message_id=$3)', [input.pdf.sha256, numberKey(input.originalNumber), input.sourceMessageId || null]);
        const duplicate = duplicateOffer(rows.rows.map(r => r.data), input);
        if (duplicate)
            return { offer: duplicate, duplicate: true };
        const existing = await client.query('SELECT id FROM price_offers WHERE lower(trim(number))=$1', [numberKey(input.originalNumber)]);
        if (existing.rowCount)
            throw new Error('Číslo už používa existujúca ponuka.');
        if (input.jobId) {
            const parent = await client.query('SELECT id FROM business_jobs WHERE id=$1 AND deleted_at IS NULL', [input.jobId]);
            if (!parent.rowCount)
                throw new Error('Zákazka nie je dostupná.');
        }
        await client.query('INSERT INTO job_workspace_manual_offers(id,original_number_key,file_sha256,source_message_id,job_id,revision,data) VALUES($1,$2,$3,$4,$5,$6,$7)', [offer.id, numberKey(input.originalNumber), input.pdf.sha256, input.sourceMessageId || null, input.jobId || null, offer.revision, offer]);
        return { offer, duplicate: false };
    });
}
async function mutateOffer<T>(id: string, actor: JobWorkspaceActor, operation: (offer: ManualPriceOffer, client: PoolClient | null, local?: Parameters<Parameters<typeof withJobWorkspaceLocalTransaction>[0]>[0]) => Promise<T>): Promise<T> {
    assertJobWorkspaceActor(actor);
    uuid(id);
    if (!getServerDatabasePool())
        return withJobWorkspaceLocalTransaction(async (local) => {
            const offer = local.jobWorkspace.manualOffers.find(o => o.id === id);
            if (!offer)
                throw new Error('Ponuka neexistuje.');
            return operation(offer, null, local);
        });
    return transaction(async (client) => {
        const row = await client.query('SELECT data FROM job_workspace_manual_offers WHERE id=$1 FOR UPDATE', [id]);
        if (!row.rows[0])
            throw new Error('Ponuka neexistuje.');
        const offer = row.rows[0].data as ManualPriceOffer;
        const result = await operation(offer, client);
        await client.query('UPDATE job_workspace_manual_offers SET revision=$2,job_id=$3,data=$4 WHERE id=$1', [id, offer.revision, offer.jobId || null, offer]);
        return result;
    });
}
export async function verifyManualPriceOfferSent(id: string, input: {
    expectedRevision: number;
    sentOn: string;
    evidence: string;
}, actor: JobWorkspaceActor) {
    return mutateOffer(id, actor, async (offer) => {
        if (offer.status === 'SENT_VERIFIED' && offer.sentOn === input.sentOn && offer.sentEvidence === input.evidence.trim())
            return clone(offer);
        if (offer.revision !== input.expectedRevision)
            throw conflict();
        if (offer.status !== 'DRAFT')
            throw new Error('Odoslaný originál už nemožno spätne prepísať.');
        nullableJobDateSchema.parse(input.sentOn);
        if (input.sentOn > today())
            throw new Error('Skutočné odoslanie nemôže byť v budúcnosti.');
        if (offer.issuedOn && input.sentOn < offer.issuedOn)
            throw new Error('Odoslanie nemôže predchádzať vystaveniu.');
        if (!input.sentOn || input.evidence.trim().length < 8)
            throw new Error('Potvrďte dátum a overiteľný dôkaz skutočného odoslania.');
        offer.status = 'SENT_VERIFIED';
        offer.sentOn = input.sentOn;
        offer.sentEvidence = input.evidence.trim().slice(0, 5000);
        offer.revision++;
        offer.updatedAt = iso();
        return clone(offer);
    });
}
export async function updateManualPriceOffer(id: string, input: {
    expectedRevision: number;
    fields: Omit<ManualPriceOfferInput, 'pdf' | 'originalNumber' | 'sourceMessageId'>;
}, actor: JobWorkspaceActor) {
    return mutateOffer(id, actor, async (offer) => {
        if (offer.revision !== input.expectedRevision)
            throw conflict();
        if (offer.status !== 'DRAFT')
            throw new Error('Upravovať možno iba rozpracovaný koncept; odoslaný originál ostáva zachovaný.');
        const revised = manualInputSchema.parse({
            ...input.fields, pdf: offer.pdf, originalNumber: offer.originalNumber, sourceMessageId: offer.sourceMessageId
        });
        offer.history = [...(offer.history ?? []), {
                at: iso(), actor: actor.email, action: 'draft.corrected', before: { ...offer, history: undefined }
            }];
        Object.assign(offer, revised, { revision: offer.revision + 1, updatedAt: iso() });
        return clone(offer);
    });
}
export async function recordManualPriceOfferOutcome(id: string, input: {
    expectedRevision: number;
    status: 'DEFERRED' | 'REJECTED';
    reason: string;
}, actor: JobWorkspaceActor) {
    return mutateOffer(id, actor, async (offer) => {
        if (offer.revision !== input.expectedRevision)
            throw conflict();
        if (!['SENT_VERIFIED', 'DEFERRED'].includes(offer.status) || !['DEFERRED', 'REJECTED'].includes(input.status) || input.reason.trim().length < 3)
            throw new Error('Vyberte výsledok odoslanej ponuky a uveďte dôvod.');
        offer.history = [...(offer.history ?? []), {
                at: iso(), actor: actor.email, action: 'outcome.recorded', before: { status: offer.status, outcomeReason: offer.outcomeReason ?? '' }
            }];
        offer.status = input.status;
        offer.outcomeReason = input.reason.trim().slice(0, 5000);
        offer.revision++;
        offer.updatedAt = iso();
        return clone(offer);
    });
}
export async function bindJobPrivateDocument(documentId: string, jobId: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(documentId);
    uuid(jobId);
    if (!getServerDatabasePool())
        return withJobWorkspaceLocalTransaction(local => {
            const document = local.jobWorkspace.documents.find(d => d.id === documentId), job = local.businessJobs.find(j => j.id === jobId && !j.deletedAt);
            if (!document || !job || (!document.jobId && document.createdBy !== actor.email && actor.role !== 'SUPER_ADMIN'))
                throw new Error('Súbor alebo zákazka nie sú dostupné.');
            if (document.jobId && document.jobId !== jobId)
                throw new Error('Súbor už patrí inej zákazke.');
            document.jobId = jobId;
            return clone(document);
        });
    return transaction(async (client) => {
        const document = (await client.query('SELECT data FROM job_workspace_documents WHERE id=$1 FOR UPDATE', [documentId])).rows[0]?.data as JobPrivateDocument | undefined;
        const job = (await client.query('SELECT id FROM business_jobs WHERE id=$1 AND deleted_at IS NULL', [jobId])).rows[0];
        if (!document || !job || (!document.jobId && document.createdBy !== actor.email && actor.role !== 'SUPER_ADMIN'))
            throw new Error('Súbor alebo zákazka nie sú dostupné.');
        if (document.jobId && document.jobId !== jobId)
            throw new Error('Súbor už patrí inej zákazke.');
        document.jobId = jobId;
        await client.query('UPDATE job_workspace_documents SET job_id=$2,data=$3 WHERE id=$1', [documentId, jobId, document]);
        return document;
    });
}
export async function getAuthorityNotice(id: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(id);
    const db = getServerDatabasePool();
    if (!db)
        return clone((await readJobWorkspaceLocalState()).jobWorkspace.notices.find(n => n.id === id) ?? null);
    return ((await db.query('SELECT data FROM job_workspace_notices WHERE id=$1', [id])).rows[0]?.data as AuthorityNotice) ?? null;
}
export async function listAuthorityNotices(jobId: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(jobId);
    const db = getServerDatabasePool();
    if (!db)
        return clone((await readJobWorkspaceLocalState()).jobWorkspace.notices.filter(n => n.jobId === jobId));
    return (await db.query('SELECT data FROM job_workspace_notices WHERE job_id=$1 ORDER BY data->>\'createdAt\' DESC', [jobId])).rows.map(r => r.data as AuthorityNotice);
}
export async function listJobWorkspaceOperationalSummaries(actor: JobWorkspaceActor, options: {
    from: string;
    to: string;
}) {
    assertJobWorkspaceActor(actor);
    nullableJobDateSchema.parse(options.from);
    nullableJobDateSchema.parse(options.to);
    if (!options.from || !options.to || options.from > options.to)
        throw new Error('Obdobie kalendára nie je platné.');
    const db = getServerDatabasePool();
    if (!db) {
        const local = await readJobWorkspaceLocalState();
        return local.jobWorkspace.cards.filter(card => [card.operations.plan.tentativeOn, card.operations.plan.agreedOn, card.operations.plan.actualOn].some(date => date && date >= options.from && date <= options.to)).flatMap(card => {
            const job = local.businessJobs.find(j => j.id === card.jobId && !j.deletedAt);
            return job ? [{
                    jobId: card.jobId, number: card.number, operations: { ...clone(card.operations), status: job.status, workType: job.workType }, customerName: job.customerName, location: job.location
                }] : [];
        });
    }
    const result = await db.query(`SELECT w.job_id,w.number,w.operations,j.status,j.work_type,j.customer_name,j.location FROM job_workspaces w JOIN business_jobs j ON j.id=w.job_id WHERE j.deleted_at IS NULL AND EXISTS(SELECT 1 FROM unnest(ARRAY[w.operations->'plan'->>'tentativeOn',w.operations->'plan'->>'agreedOn',w.operations->'plan'->>'actualOn']) date WHERE date>=$1 AND date<=$2) ORDER BY w.number`, [options.from, options.to]);
    return result.rows.map(row => ({
        jobId: String(row.job_id), number: String(row.number), operations: { ...row.operations, status: row.status, workType: row.work_type } as FinancialJobWorkspaceCard['operations'], customerName: String(row.customer_name), location: String(row.location)
    }));
}
export async function acceptManualPriceOffer(id: string, input: {
    expectedRevision: number;
    responsibleEmail: string;
    acceptedOn: string;
}, actor: JobWorkspaceActor) {
    return mutateOffer(id, actor, async (offer, client, local) => {
        if (offer.status === 'ACCEPTED' && offer.jobId)
            return { offer: clone(offer), jobId: offer.jobId };
        if (offer.revision !== input.expectedRevision)
            throw conflict();
        if (!['SENT_VERIFIED', 'DEFERRED'].includes(offer.status))
            throw new Error('Prijať možno iba overenú odoslanú alebo odloženú ponuku.');
        z.email().parse(input.responsibleEmail);
        await assertAssignableUser(input.responsibleEmail, client ?? undefined);
        nullableJobDateSchema.parse(input.acceptedOn);
        if (!input.acceptedOn)
            throw new Error('Doplňte skutočný dátum potvrdenia.');
        if (input.acceptedOn > today() || (offer.sentOn && input.acceptedOn < offer.sentOn))
            throw new Error('Dátum potvrdenia nesmie byť v budúcnosti ani pred odoslaním.');
        offer.history = [...(offer.history ?? []), {
                at: iso(), actor: actor.email, action: 'offer.accepted', before: { status: offer.status, outcomeReason: offer.outcomeReason ?? '' }
            }];
        const timestamp = iso();
        let jobId = offer.jobId || undefined;
        if (local) {
            if (!jobId && offer.leadId)
                jobId = local.businessJobs.find(j => j.leadId === offer.leadId && !j.deletedAt)?.id;
            if (jobId && !local.businessJobs.some(j => j.id === jobId && !j.deletedAt))
                throw new Error('Prepojená zákazka je archivovaná alebo chýba.');
            if (!jobId) {
                jobId = randomUUID();
                local.businessJobs.push({
                    id: jobId, leadId: offer.leadId || undefined, createdAt: timestamp, updatedAt: timestamp, demolitionDate: '', customerName: offer.contactPerson, customerPhone: offer.phone, customerEmail: offer.email, location: offer.address, district: '', materialType: '', objectType: '', term: '', leadSource: 'manual_pdf', preferredContact: '', m2: 0, pricePerM2: 0, totalPrice: 0, paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', wasteKg: 0, landfill: 'INA', status: 'PONUKA_POTVRDENA', note: '', workers: [], costs: {
                        jobId, fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0, total: 0
                    }, rewardsTotal: 0, grossProfit: 0, marginPercent: 0
                });
            }
            const job = local.businessJobs.find(j => j.id === jobId)!;
            job.status = acceptedJobStatus(job.status);
            job.updatedAt = timestamp;
            let card = local.jobWorkspace.cards.find(c => c.jobId === jobId);
            if (!card) {
                card = acceptedOfferCard(blankCard(jobId, job), offer, job.status, input.responsibleEmail, actor);
                local.jobWorkspace.cards.push(card);
            }
            else {
                const next = acceptedOfferCard(card, offer, job.status, input.responsibleEmail, actor);
                local.jobWorkspace.cards[local.jobWorkspace.cards.indexOf(card)] = next;
            }
        }
        else if (client) {
            if (offer.leadId) {
                await client.query('SELECT id FROM leads WHERE id=$1 FOR UPDATE', [offer.leadId]);
                if (!jobId) {
                    const linked = await client.query('SELECT id FROM business_jobs WHERE lead_id=$1 AND deleted_at IS NULL ORDER BY created_at LIMIT 2', [offer.leadId]);
                    if (linked.rowCount && linked.rowCount > 1)
                        throw new Error('Dopyt má viac zákaziek; vyberte správnu kartu ručne.');
                    jobId = linked.rows[0]?.id;
                }
            }
            if (jobId) {
                const job = await client.query('SELECT id,status FROM business_jobs WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [jobId]);
                if (!job.rowCount)
                    throw new Error('Prepojená zákazka je archivovaná alebo chýba.');
                acceptedJobStatus(job.rows[0].status);
            }
            if (!jobId) {
                jobId = randomUUID();
                await client.query(`INSERT INTO business_jobs(id,lead_id,created_at,updated_at,demolition_date,customer_name,customer_phone,customer_email,location,status,lead_source) VALUES($1,$2,$3,$3,NULL,$4,$5,$6,$7,'PONUKA_POTVRDENA','manual_pdf')`, [jobId, offer.leadId || null, timestamp, offer.contactPerson, offer.phone, offer.email, offer.address]);
            }
            const parent = (await client.query('SELECT created_at,status,work_type,demolition_date FROM business_jobs WHERE id=$1', [jobId])).rows[0];
            const status = acceptedJobStatus(parent.status);
            await client.query('UPDATE business_jobs SET status=$2,updated_at=$3 WHERE id=$1', [jobId, status, timestamp]);
            const existing = await client.query("SELECT job_id,number,revision,price_override,actual_date_override,operations,COALESCE((SELECT jsonb_agg(event) FROM jsonb_array_elements(timeline) event WHERE event->>'visibility'='OPERATIONS'),'[]'::jsonb) AS timeline,created_at,updated_at,updated_by FROM job_workspaces WHERE job_id=$1 FOR UPDATE", [jobId]);
            if (!existing.rows[0]) {
                const next = acceptedOfferCard(blankCard(jobId, { createdAt: new Date(parent.created_at).toISOString(), status, workType: parent.work_type }), offer, status, input.responsibleEmail, actor);
                await persistCard(client, next, 0);
            }
            else {
                const current = fromRow(existing.rows[0], false);
                const next = acceptedOfferCard(current, offer, status, input.responsibleEmail, actor);
                await persistCard(client, next, current.revision, false);
                if (!current.priceOverride)
                    await client.query("UPDATE job_workspaces SET price_override=true,settlement=jsonb_set(settlement,'{agreedAmountWithVatCents}',$2::jsonb) WHERE job_id=$1", [jobId, JSON.stringify(offer.totalWithVatCents)]);
            }
        }
        if (!jobId)
            throw new Error('Zákazku sa nepodarilo prepojiť.');
        if (local) {
            const parent = local.businessJobs.find(j => j.id === jobId)!;
            const card = local.jobWorkspace.cards.find(c => c.jobId === jobId)!;
            if (card.priceOverride) {
                const amount = card.settlement.actualAmountWithVatCents ?? card.settlement.agreedAmountWithVatCents;
                parent.totalPrice = amount === null ? 0 : amount / 100;
                parent.totalPriceKnown = amount !== null;
                parent.priceOverridden = true;
            }
            const document = local.jobWorkspace.documents.find(d => d.id === offer.pdf.documentId);
            if (!document || Boolean(document.jobId && document.jobId !== jobId))
                throw new Error('Originál už patrí inej zákazke.');
            document.jobId = jobId;
        }
        if (client) {
            const pricing = (await client.query('SELECT price_override,settlement FROM job_workspaces WHERE job_id=$1', [jobId])).rows[0];
            if (pricing?.price_override) {
                const amount = pricing.settlement.actualAmountWithVatCents ?? pricing.settlement.agreedAmountWithVatCents;
                await client.query('UPDATE business_jobs SET total_price=$2,total_price_overridden=true WHERE id=$1', [jobId, amount === null ? null : amount / 100]);
            }
            const document = (await client.query('SELECT data FROM job_workspace_documents WHERE id=$1 FOR UPDATE', [offer.pdf.documentId])).rows[0]?.data as JobPrivateDocument | undefined;
            if (!document || Boolean(document.jobId && document.jobId !== jobId))
                throw new Error('Originál už patrí inej zákazke.');
            document.jobId = jobId;
            await client.query('UPDATE job_workspace_documents SET job_id=$2,data=$3 WHERE id=$1', [document.id, jobId, document]);
        }
        offer.jobId = jobId;
        offer.status = 'ACCEPTED';
        offer.acceptedOn = input.acceptedOn;
        offer.acceptedBy = actor.email;
        offer.revision++;
        offer.updatedAt = timestamp;
        return { offer: clone(offer), jobId };
    });
}
export async function registerJobPrivateDocument(input: Omit<JobPrivateDocument, 'createdAt' | 'createdBy'>, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(input.id);
    if (input.jobId)
        uuid(input.jobId);
    if (!/^[a-f0-9]{64}$/.test(input.sha256) || !Number.isSafeInteger(input.size) || input.size < 1 || input.size > 30000000 || !input.storageKey || /^https?:/i.test(input.storageKey))
        throw new Error('Súkromný súbor má neplatné metadáta.');
    const document: JobPrivateDocument = { ...input, createdAt: iso(), createdBy: actor.email };
    const db = getServerDatabasePool();
    if (!db)
        return withJobWorkspaceLocalTransaction(local => {
            if (input.jobId && !local.businessJobs.some(j => j.id === input.jobId && !j.deletedAt))
                throw new Error('Zákazka neexistuje.');
            const existing = local.jobWorkspace.documents.find(d => d.id === input.id);
            if (existing) {
                if (existing.sha256 !== input.sha256 || existing.storageKey !== input.storageKey)
                    throw new Error('Originál súboru sa nesmie prepísať.');
                return clone(existing);
            }
            local.jobWorkspace.documents.push(document);
            return clone(document);
        });
    return transaction(async (client) => {
        if (input.jobId) {
            const parent = await client.query('SELECT id FROM business_jobs WHERE id=$1 AND deleted_at IS NULL', [input.jobId]);
            if (!parent.rowCount)
                throw new Error('Zákazka neexistuje.');
        }
        await client.query('INSERT INTO job_workspace_documents(id,job_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING', [input.id, input.jobId, document]);
        const row = await client.query('SELECT data FROM job_workspace_documents WHERE id=$1', [input.id]);
        const existing = row.rows[0].data as JobPrivateDocument;
        if (existing.sha256 !== input.sha256 || existing.storageKey !== input.storageKey)
            throw new Error('Originál súboru sa nesmie prepísať.');
        return existing;
    });
}
export async function getJobPrivateDocument(id: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(id);
    const db = getServerDatabasePool();
    const document: JobPrivateDocument | null = db ? (await db.query('SELECT data FROM job_workspace_documents WHERE id=$1', [id])).rows[0]?.data ?? null : (await readJobWorkspaceLocalState()).jobWorkspace.documents.find(d => d.id === id) ?? null;
    if (document && !document.jobId && document.createdBy !== actor.email && actor.role !== 'SUPER_ADMIN')
        return null;
    return clone(document);
}
export async function listJobPrivateDocuments(jobId: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(jobId);
    const db = getServerDatabasePool();
    if (!db)
        return clone((await readJobWorkspaceLocalState()).jobWorkspace.documents.filter(d => d.jobId === jobId));
    return (await db.query('SELECT data FROM job_workspace_documents WHERE job_id=$1 ORDER BY data->>\'createdAt\' DESC', [jobId])).rows.map(r => r.data as JobPrivateDocument);
}
export async function appendJobCommunication(input: JobCommunicationInput, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(input.jobId);
    if (input.source === 'GMAIL' && actor.role !== 'SUPER_ADMIN')
        throw new Error('Pripojenie Gmail správy musí potvrdiť superadmin.');
    if (!['MANUAL', 'GMAIL'].includes(input.source) || !['INBOUND', 'OUTBOUND', 'NOTE'].includes(input.direction) || Number.isNaN(Date.parse(input.occurredAt)) || input.text.length > 100000 || input.documentIds.length > 50)
        throw new Error('Komunikácia obsahuje neplatné údaje.');
    for (const id of input.documentIds)
        uuid(id);
    const record: JobCommunication = {
        ...input, id: randomUUID(), createdAt: iso(), createdBy: actor.email
    };
    const db = getServerDatabasePool();
    if (!db)
        return withJobWorkspaceLocalTransaction(local => {
            if (!local.businessJobs.some(j => j.id === input.jobId && !j.deletedAt))
                throw new Error('Zákazka neexistuje.');
            const existing = input.sourceMessageId ? local.jobWorkspace.communications.find(c => c.sourceMessageId === input.sourceMessageId) : undefined;
            if (existing) {
                if (existing.jobId !== input.jobId)
                    throw new Error('Správa už patrí inej zákazke.');
                return clone(existing);
            }
            for (const id of input.documentIds) {
                const document = local.jobWorkspace.documents.find(d => d.id === id);
                if (!document || Boolean(document.jobId && document.jobId !== input.jobId) || (!document.jobId && document.createdBy !== actor.email && actor.role !== 'SUPER_ADMIN'))
                    throw new Error('Príloha komunikácie nie je dostupná.');
                document.jobId = input.jobId;
            }
            local.jobWorkspace.communications.push(record);
            return clone(record);
        });
    return transaction(async (client) => {
        const parent = await client.query('SELECT id FROM business_jobs WHERE id=$1 AND deleted_at IS NULL', [input.jobId]);
        if (!parent.rowCount)
            throw new Error('Zákazka neexistuje.');
        for (const id of input.documentIds) {
            const document = (await client.query('SELECT data FROM job_workspace_documents WHERE id=$1 FOR UPDATE', [id])).rows[0]?.data as JobPrivateDocument | undefined;
            if (!document || Boolean(document.jobId && document.jobId !== input.jobId) || (!document.jobId && document.createdBy !== actor.email && actor.role !== 'SUPER_ADMIN'))
                throw new Error('Príloha komunikácie nie je dostupná.');
            document.jobId = input.jobId;
            await client.query('UPDATE job_workspace_documents SET job_id=$2,data=$3 WHERE id=$1', [id, input.jobId, document]);
        }
        const inserted = await client.query('INSERT INTO job_workspace_communications(id,job_id,source_message_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(source_message_id) DO NOTHING RETURNING data', [record.id, input.jobId, input.sourceMessageId || null, record]);
        if (inserted.rows[0])
            return inserted.rows[0].data as JobCommunication;
        const existing = (await client.query('SELECT data FROM job_workspace_communications WHERE source_message_id=$1', [input.sourceMessageId])).rows[0].data as JobCommunication;
        if (existing.jobId !== input.jobId)
            throw new Error('Správa už patrí inej zákazke.');
        return existing;
    });
}
export async function listJobCommunications(jobId: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(jobId);
    const db = getServerDatabasePool();
    if (!db)
        return clone((await readJobWorkspaceLocalState()).jobWorkspace.communications.filter(c => c.jobId === jobId));
    return (await db.query('SELECT data FROM job_workspace_communications WHERE job_id=$1 ORDER BY data->>\'occurredAt\' DESC', [jobId])).rows.map(r => r.data as JobCommunication);
}
export async function prepareAuthorityNotice(jobId: string, input: {
    operationId: string;
    expectedRevision: number;
}, actor: JobWorkspaceActor): Promise<AuthorityNotice> {
    assertJobWorkspaceActor(actor);
    uuid(jobId);
    z.uuid().parse(input.operationId);
    const make = (card: FinancialJobWorkspaceCard, email: string): AuthorityNotice => {
        if (card.revision !== input.expectedRevision)
            throw conflict();
        if (!z.email().safeParse(email).success)
            throw new Error('Zákazka nemá platný email objednávateľa.');
        const snapshot = (['OU_ZP', 'RUVZ'] as const).flatMap(authority => {
            const record = card.operations.authorities[authority];
            return record.submittedOn && record.decision === 'PENDING' ? [{ authority, submittedOn: record.submittedOn, reference: record.reference }] : [];
        });
        if (!snapshot.length)
            throw new Error('Najprv potvrďte skutočné podanie aspoň jednému úradu.');
        const lines = snapshot.map(r => `${r.authority === 'OU_ZP' ? 'OÚ ŽP' : 'RÚVZ'}: ${r.submittedOn}${r.reference ? ` (číslo ${r.reference})` : ''}`);
        return {
            id: randomUUID(), jobId, operationId: input.operationId, workspaceRevision: card.revision, recipient: email, snapshot, subject: `Podklady k zákazke ${card.number} boli odoslané`, text: `Dobrý deň,\n\npotvrdzujeme odoslanie podkladov k vašej zákazke:\n${lines.join('\n')}\n\nTeraz čakáme na vybavenie príslušného podania. O ďalšom postupe vás budeme informovať.\n\nASTANA s.r.o.`, state: 'PREPARED', createdAt: iso(), createdBy: actor.email, attemptId: null, sentAt: null
        };
    };
    if (!getServerDatabasePool())
        return withJobWorkspaceLocalTransaction(local => {
            const existing = local.jobWorkspace.notices.find(n => n.jobId === jobId && n.operationId === input.operationId);
            if (existing && existing.state !== 'PREPARED')
                return clone(existing);
            const card = local.jobWorkspace.cards.find(c => c.jobId === jobId), job = local.businessJobs.find(j => j.id === jobId && !j.deletedAt);
            if (!card || !job)
                throw new Error('Zákazka nie je dostupná.');
            const notice = make(card, job.customerEmail);
            const duplicate = local.jobWorkspace.notices.find(n => n.jobId === jobId && n.recipient === notice.recipient && canonical(n.snapshot) === canonical(notice.snapshot));
            if (duplicate) {
                if (duplicate.state === 'PREPARED') {
                    duplicate.workspaceRevision = card.revision;
                }
                return clone(duplicate);
            }
            if (existing)
                throw new Error('Podania sa zmenili. Pripravte nový náhľad s novou operáciou.');
            local.jobWorkspace.notices.push(notice);
            return clone(notice);
        });
    return transaction(async (client) => {
        const job = (await client.query('SELECT customer_email FROM business_jobs WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [jobId])).rows[0];
        const existing = (await client.query('SELECT data FROM job_workspace_notices WHERE job_id=$1 AND operation_id=$2', [jobId, input.operationId])).rows[0];
        if (existing && existing.data.state !== 'PREPARED')
            return existing.data;
        const row = (await client.query('SELECT job_id,number,revision,price_override,actual_date_override,operations,timeline,created_at,updated_at,updated_by FROM job_workspaces WHERE job_id=$1', [jobId])).rows[0];
        if (!row || !job)
            throw new Error('Zákazka nie je dostupná.');
        const notice = make(fromRow(row, false), job.customer_email);
        const prior = (await client.query('SELECT data FROM job_workspace_notices WHERE job_id=$1', [jobId])).rows.map(r => r.data as AuthorityNotice).find(n => n.recipient === notice.recipient && canonical(n.snapshot) === canonical(notice.snapshot));
        if (prior) {
            if (prior.state === 'PREPARED') {
                prior.workspaceRevision = notice.workspaceRevision;
                await client.query('UPDATE job_workspace_notices SET data=$2 WHERE id=$1', [prior.id, prior]);
            }
            return prior;
        }
        if (existing)
            throw new Error('Podania sa zmenili. Pripravte nový náhľad s novou operáciou.');
        await client.query('INSERT INTO job_workspace_notices(id,job_id,operation_id,data) VALUES($1,$2,$3,$4)', [notice.id, jobId, input.operationId, notice]);
        return notice;
    });
}
async function mutateNotice<T>(id: string, actor: JobWorkspaceActor, operation: (notice: AuthorityNotice) => T) {
    assertJobWorkspaceActor(actor);
    uuid(id);
    if (!getServerDatabasePool())
        return withJobWorkspaceLocalTransaction(local => {
            const notice = local.jobWorkspace.notices.find(n => n.id === id);
            if (!notice)
                throw new Error('Oznámenie neexistuje.');
            return clone(operation(notice));
        });
    return transaction(async (client) => {
        const row = (await client.query('SELECT data FROM job_workspace_notices WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!row)
            throw new Error('Oznámenie neexistuje.');
        const notice = row.data as AuthorityNotice;
        const result = operation(notice);
        await client.query('UPDATE job_workspace_notices SET data=$2 WHERE id=$1', [id, notice]);
        return result;
    });
}
export async function claimAuthorityNotice(id: string, actor: JobWorkspaceActor) {
    assertJobWorkspaceActor(actor);
    uuid(id);
    const claim = (notice: AuthorityNotice, revision: number, email: string) => {
        if (notice.state !== 'PREPARED')
            return null;
        if (notice.workspaceRevision !== revision || notice.recipient !== email)
            throw new Error('Údaje alebo adresát sa zmenili. Pripravte nový náhľad oznámenia.');
        notice.state = 'SENDING';
        notice.attemptId = randomUUID();
        return clone(notice);
    };
    if (!getServerDatabasePool())
        return withJobWorkspaceLocalTransaction(local => {
            const notice = local.jobWorkspace.notices.find(n => n.id === id);
            if (!notice)
                throw new Error('Oznámenie neexistuje.');
            if (notice.state !== 'PREPARED')
                return null;
            const card = local.jobWorkspace.cards.find(c => c.jobId === notice.jobId), job = local.businessJobs.find(j => j.id === notice.jobId && !j.deletedAt);
            if (!card || !job)
                throw new Error('Zákazka nie je dostupná.');
            return claim(notice, card.revision, job.customerEmail);
        });
    return transaction(async (client) => {
        const notice = (await client.query('SELECT data FROM job_workspace_notices WHERE id=$1 FOR UPDATE', [id])).rows[0]?.data as AuthorityNotice | undefined;
        if (!notice)
            throw new Error('Oznámenie neexistuje.');
        if (notice.state !== 'PREPARED')
            return null;
        const row = (await client.query('SELECT w.revision,j.customer_email FROM job_workspaces w JOIN business_jobs j ON j.id=w.job_id WHERE w.job_id=$1 AND j.deleted_at IS NULL FOR UPDATE OF w,j', [notice.jobId])).rows[0];
        if (!row)
            throw new Error('Zákazka nie je dostupná.');
        const result = claim(notice, Number(row.revision), String(row.customer_email));
        await client.query('UPDATE job_workspace_notices SET data=$2 WHERE id=$1', [id, notice]);
        return result;
    });
}
export async function finalizeAuthorityNotice(id: string, attemptId: string, state: 'SENT' | 'UNCERTAIN' | 'FAILED', actor: JobWorkspaceActor) {
    return mutateNotice(id, actor, notice => {
        if (notice.attemptId !== attemptId || notice.state !== 'SENDING')
            throw new Error('Výsledok nepatrí aktívnemu pokusu.');
        if (!['SENT', 'UNCERTAIN', 'FAILED'].includes(state))
            throw new Error('Neplatný výsledok odoslania.');
        notice.state = state;
        if (state === 'SENT')
            notice.sentAt = iso();
        return clone(notice);
    });
}
