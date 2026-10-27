import { z } from 'zod';
import type { BusinessJob, OperationalBusinessJob } from './types';
import type { FinancialJobWorkspaceCard, JobWorkspaceActor, JobWorkspaceCard, JobWorkspaceOperations, JobWorkspaceSettlement } from './job-workspace-types';
export function assertJobWorkspaceActor(actor: JobWorkspaceActor, financial = false) {
    if (!actor || !['OPERATOR', 'SUPER_ADMIN'].includes(actor.role) || !z.email().safeParse(actor.email).success || (financial && actor.role !== 'SUPER_ADMIN'))
        throw new Error('Na túto operáciu nemáte oprávnenie.');
}
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Neplatný kalendárny dátum.').nullable();
const quantity = z.number().finite().min(0).max(1000000000).nullable();
const text = z.string().trim().max(5000);
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(new Date());
const tri = z.enum(['UNKNOWN', 'YES', 'NO']);
const material = z.object({
    id: z.uuid(), kind: z.enum(['VLNITY_ETERNIT', 'HLADKY_ETERNIT', 'INTERIER', 'AZBESTOVE_RURY', 'VZDUCHOTECHNIKA', 'INE']), label: text, unit: z.enum(['M2', 'M', 'KS', 'KG']), plannedQuantity: quantity, actualQuantity: quantity, plannedKg: quantity, actualKg: quantity
}).strict();
const authority = z.object({
    required: tri, submittedOn: date, submissionMethod: text, reference: text, documentId: z.uuid().nullable(), decision: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NOT_APPLICABLE']), decisionOn: date, note: text
}).strict().superRefine((value, ctx) => {
    if (value.required === 'NO' && value.submittedOn)
        ctx.addIssue({ code: 'custom', message: 'Nepotrebné podanie nemôže byť označené za odoslané.' });
    if (value.decisionOn && !['APPROVED', 'REJECTED'].includes(value.decision))
        ctx.addIssue({ code: 'custom', message: 'Dátum rozhodnutia vyžaduje jeho výsledok.' });
    if (['APPROVED', 'REJECTED'].includes(value.decision) && (!value.submittedOn || !value.decisionOn))
        ctx.addIssue({ code: 'custom', message: 'Rozhodnutie potrebuje skutočné podanie aj dátum rozhodnutia.' });
    if (value.submittedOn && value.decisionOn && value.decisionOn < value.submittedOn)
        ctx.addIssue({ code: 'custom', message: 'Rozhodnutie nemôže predchádzať podaniu.' });
    if ((value.submittedOn && value.submittedOn > today()) || (value.decisionOn && value.decisionOn > today()))
        ctx.addIssue({ code: 'custom', message: 'Skutočné podanie ani rozhodnutie nemôžu byť v budúcnosti.' });
});
export const jobWorkspaceOperationsSchema = z.object({
    responsibleEmail: z.union([z.email(), z.literal('')]), workType: z.enum(['DEMONTAZ', 'ODVOZ', 'DEMONTAZ_A_ODVOZ']),
    status: z.enum(['DOPYT', 'DOPYT_PRIJATY', 'PONUKA_ODOSLANA', 'PRIJATA', 'PONUKA_POTVRDENA', 'URADY_PODANE', 'URADY_SCHVALENE', 'V_REALIZACII', 'DEMONT_NAPLANOVANA', 'DEMONT_DOKONCENA', 'VYUCTOVANIE', 'DOKONCENA', 'ZRUSENA']),
    materials: z.array(material).max(100), authorities: z.object({ OU_ZP: authority, RUVZ: authority }).strict(),
    plan: z.object({
        tentativeOn: date, agreedOn: date, actualOn: date, timeFrom: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/), timeTo: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/), crewIds: z.array(z.uuid()).max(100), plannedCrewCount: quantity, actualCrewCount: quantity, vehicleIds: z.array(z.string().max(80)).max(100), plannedVehicleCount: quantity, actualVehicleCount: quantity, confirmedCapacityKg: quantity, plannedKm: quantity, actualKm: quantity, distanceBasis: z.enum(['UNKNOWN', 'ONE_WAY_FROM_POPRAD', 'ROUND_TRIP_FROM_POPRAD']), scaffolding: tri, platform: tri, accessNote: text, promotionNote: text, rescheduleReason: text
    }).strict(), note: text,
}).strict().superRefine((value, ctx) => {
    if (value.plan.actualOn && value.plan.actualOn > today())
        ctx.addIssue({ code: 'custom', message: 'Skutočný deň realizácie nemôže byť v budúcnosti.' });
    if (value.plan.timeFrom && value.plan.timeTo && value.plan.timeTo <= value.plan.timeFrom)
        ctx.addIssue({ code: 'custom', message: 'Koniec práce musí byť po jej začiatku.' });
    for (const key of ['plannedCrewCount', 'actualCrewCount', 'plannedVehicleCount', 'actualVehicleCount'] as const)
        if (value.plan[key] !== null && !Number.isSafeInteger(value.plan[key]))
            ctx.addIssue({ code: 'custom', message: 'Počet ľudí a vozidiel musí byť celé číslo.' });
    if (new Set(value.plan.crewIds).size !== value.plan.crewIds.length || new Set(value.plan.vehicleIds).size !== value.plan.vehicleIds.length)
        ctx.addIssue({ code: 'custom', message: 'Posádka a vozidlá nesmú obsahovať duplicitné položky.' });
});
export const jobWorkspaceSettlementSchema = z.object({
    documentType: z.enum(['UNDECIDED', 'INVOICE', 'OTHER_DOCUMENT']), agreedAmountWithVatCents: quantity, actualAmountWithVatCents: quantity, plannedCostCents: quantity, actualCostCents: quantity, note: text
}).strict().superRefine((value, ctx) => {
    for (const key of ['agreedAmountWithVatCents', 'actualAmountWithVatCents', 'plannedCostCents', 'actualCostCents'] as const)
        if (value[key] !== null && !Number.isSafeInteger(value[key]))
            ctx.addIssue({ code: 'custom', message: 'Sumy musia byť celé centy.' });
});
export const nullableJobDateSchema = date;
export function workspaceCalendarDay(value: unknown): string {
    if (value instanceof Date)
        return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(value);
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}
export function inheritLegacyActualDate(card: FinancialJobWorkspaceCard, legacyDate: unknown, status: BusinessJob['status']) {
    if (card.actualDateOverride)
        return;
    const day = workspaceCalendarDay(legacyDate);
    if (['DEMONT_DOKONCENA', 'VYUCTOVANIE', 'DOKONCENA'].includes(status))
        card.operations.plan.actualOn = day && day <= today() ? day : null;
}
/** Legacy forms cannot turn a scheduled/stale date into an already managed actual day. */
export function preserveManagedActualDate(card: FinancialJobWorkspaceCard | undefined, legacyDate: string) {
    return card?.actualDateOverride ? (card.operations.plan.actualOn ?? '') : legacyDate;
}
export function recordLegacyActualDateChange(card: Pick<FinancialJobWorkspaceCard, 'jobId' | 'actualDateOverride' | 'operations' | 'revision' | 'updatedAt' | 'updatedBy' | 'timeline'>, previousDay: string, nextDay: string, status: BusinessJob['status'], actorEmail: string, timestamp: string) {
    if (card.actualDateOverride)
        return card.operations.plan.actualOn ?? '';
    if (previousDay === nextDay || !['DEMONT_DOKONCENA', 'VYUCTOVANIE', 'DOKONCENA'].includes(status))
        return nextDay;
    if (nextDay && (!date.safeParse(nextDay).success || nextDay > today()))
        throw new Error('Skutočný deň realizácie nemôže byť neplatný alebo v budúcnosti.');
    card.operations.plan.actualOn = nextDay || null;
    card.revision++;
    card.updatedAt = timestamp;
    card.updatedBy = actorEmail;
    card.timeline.push({
        id: crypto.randomUUID(), jobId: card.jobId, revision: card.revision, actorEmail, recordedAt: timestamp, action: 'operations.actual_day_changed', visibility: 'OPERATIONS', changes: {
            before: previousDay || null, after: nextDay || null, cleared: !nextDay, source: 'legacy_actual_date'
        }
    });
    return nextDay;
}
export function emptyJobWorkspaceOperations(job?: Pick<BusinessJob | OperationalBusinessJob, 'status' | 'workType'>): JobWorkspaceOperations {
    const authority = () => ({
        required: 'UNKNOWN' as const, submittedOn: null, submissionMethod: '', reference: '', documentId: null, decision: 'PENDING' as const, decisionOn: null, note: ''
    });
    return {
        responsibleEmail: '', workType: job?.workType ?? 'DEMONTAZ_A_ODVOZ', status: job?.status ?? 'DOPYT', materials: [], authorities: { OU_ZP: authority(), RUVZ: authority() }, plan: {
            tentativeOn: null, agreedOn: null, actualOn: null, timeFrom: '', timeTo: '', crewIds: [], plannedCrewCount: null, actualCrewCount: null, vehicleIds: [], plannedVehicleCount: null, actualVehicleCount: null, confirmedCapacityKg: null, plannedKm: null, actualKm: null, distanceBasis: 'UNKNOWN', scaffolding: 'UNKNOWN', platform: 'UNKNOWN', accessNote: '', promotionNote: '', rescheduleReason: ''
        }, note: ''
    };
}
export function emptyJobWorkspaceSettlement(): JobWorkspaceSettlement {
    return {
        documentType: 'UNDECIDED', agreedAmountWithVatCents: null, actualAmountWithVatCents: null, plannedCostCents: null, actualCostCents: null, note: ''
    };
}
export function createInitialJobWorkspaceCard(job: Pick<BusinessJob, 'id' | 'createdAt' | 'status' | 'workType'>, actorEmail: string, responsibleEmail = '', agreedAmountWithVatCents: number | null = null): FinancialJobWorkspaceCard {
    const timestamp = new Date().toISOString(), operations = emptyJobWorkspaceOperations(job);
    operations.responsibleEmail = responsibleEmail;
    return {
        jobId: job.id, number: `ZAK-${job.createdAt.slice(0, 4)}-${job.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`, revision: 1, createdAt: timestamp, updatedAt: timestamp, updatedBy: actorEmail, priceOverride: true, operations, settlement: { ...emptyJobWorkspaceSettlement(), agreedAmountWithVatCents }, timeline: [{
                id: crypto.randomUUID(), jobId: job.id, revision: 1, actorEmail, recordedAt: timestamp, action: 'offer.accepted', visibility: 'OPERATIONS', changes: { responsibleEmail }
            }]
    };
}
export function projectJobWorkspace(card: FinancialJobWorkspaceCard, actor: JobWorkspaceActor): JobWorkspaceCard | FinancialJobWorkspaceCard {
    assertJobWorkspaceActor(actor);
    if (actor.role === 'SUPER_ADMIN')
        return structuredClone(card);
    return {
        jobId: card.jobId, actualDateOverride: card.actualDateOverride, number: card.number, revision: card.revision, createdAt: card.createdAt, updatedAt: card.updatedAt, updatedBy: card.updatedBy, operations: structuredClone(card.operations), timeline: structuredClone(card.timeline.filter((event) => event.visibility === 'OPERATIONS'))
    };
}
