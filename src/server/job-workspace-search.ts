import type { Pool } from 'pg';
import type { AdminSearchData } from './db';
import type { JobWorkspaceSearchOptions, JobWorkspaceStore } from './job-workspace-types';
import type { BusinessJob, BusinessJobInvoice, Lead, PriceOffer, ReviewRequest } from './types';
type SearchLocalData = {
    leads: Lead[];
    businessJobs: BusinessJob[];
    priceOffers: PriceOffer[];
    reviewRequests: ReviewRequest[];
    businessJobInvoices: BusinessJobInvoice[];
    jobWorkspace: JobWorkspaceStore;
};
const fold = (value: unknown) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sk');
const manualStatusForSearch = (status: string) => ({
    PRIPRAVENA: 'DRAFT', ODOSLANA: 'SENT_VERIFIED', PRIJATA: 'ACCEPTED', ODLOZENA: 'DEFERRED', NEUSPESNA: 'REJECTED'
}[status] ?? status);
export function adminSearchTokens(query: string) {
    return fold(query.trim().slice(0, 240)).split(/\s+/).filter(Boolean).slice(0, 16);
}
export function matchesAdminSearchTokens(tokens: string[], values: unknown[]) {
    const haystack = fold(values.join(' ')), compact = haystack.replace(/[^a-z0-9]+/g, '');
    return tokens.every(token => haystack.includes(token) || (token.replace(/[^a-z0-9]+/g, '').length >= 2 && compact.includes(token.replace(/[^a-z0-9]+/g, ''))));
}
function optionsNormalized(options: JobWorkspaceSearchOptions) {
    return {
        ...options, page: Math.max(1, Math.trunc(options.page ?? 1) || 1), pageSize: Math.min(100, Math.max(1, Math.trunc(options.pageSize ?? 20) || 20)), archived: options.archived ?? 'exclude'
    };
}
function withPage(groups: AdminSearchData, options: ReturnType<typeof optionsNormalized>) {
    const keys = ['leads', 'jobs', 'offers', 'reviews', 'finance'] as const;
    const totals = Object.fromEntries(keys.map(key => [key, groups[key].length])) as Record<typeof keys[number], number>;
    const totalPages = Math.max(1, ...Object.values(totals).map(total => Math.ceil(total / options.pageSize)));
    const page = Math.min(options.page, totalPages);
    const result = { ...groups, pagination: {
            page, pageSize: options.pageSize, totalPages, totals
        } };
    for (const key of keys)
        (result[key] as unknown[]) = groups[key].slice((page - 1) * options.pageSize, page * options.pageSize);
    return result;
}
export function searchJobWorkspaceLocalData(local: SearchLocalData, query: string, includeFinance: boolean, rawOptions: JobWorkspaceSearchOptions = {}): AdminSearchData {
    const tokens = adminSearchTokens(query), options = optionsNormalized(rawOptions);
    const empty = {
        leads: [], jobs: [], offers: [], reviews: [], finance: []
    };
    if (tokens.join('').length < 2)
        return withPage(empty, options);
    const matches = (...values: unknown[]) => matchesAdminSearchTokens(tokens, values);
    const filtered = (createdAt: string, status: string, deletedAt?: string | null, manual = false) => {
        const archived = Boolean(deletedAt);
        return (options.archived === 'include' || (options.archived === 'only' ? archived : !archived)) && (!options.year || createdAt.slice(0, 4) === String(options.year)) && (!options.status || status === (manual ? manualStatusForSearch(options.status) : options.status));
    };
    const testLeadIds = new Set(local.leads.filter(l => l.isTestData).map(l => l.id)), testJobIds = new Set(local.businessJobs.filter(j => j.isTestData || Boolean(j.leadId && testLeadIds.has(j.leadId))).map(j => j.id));
    const cards = new Map(local.jobWorkspace.cards.map(c => [c.jobId, c])), jobs = new Map(local.businessJobs.map(j => [j.id, j]));
    const manualByJob = new Map<string, string[]>();
    for (const offer of local.jobWorkspace.manualOffers)
        if (offer.jobId)
            manualByJob.set(offer.jobId, [...(manualByJob.get(offer.jobId) ?? []), offer.originalNumber]);
    for (const offer of local.priceOffers)
        if (offer.jobId)
            manualByJob.set(offer.jobId, [...(manualByJob.get(offer.jobId) ?? []), offer.number]);
    const jobExtraMatch = (job: BusinessJob) => {
        const card = cards.get(job.id);
        return (!options.responsibleEmail || card?.operations.responsibleEmail === options.responsibleEmail) && (!options.workType || job.workType === options.workType);
    };
    const leads = local.leads.filter(l => !l.isTestData && filtered(l.createdAt, l.status, l.deletedAt) && !options.responsibleEmail && !options.workType && matches(l.fullName, l.phone, l.email, l.city, l.district, l.id, l.note, l.internalNote, l.materialType, l.objectType)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(l => ({
        id: l.id, fullName: l.fullName, phone: l.phone, email: l.email, city: l.city, status: l.status
    }));
    const foundJobs = local.businessJobs.filter(j => !testJobIds.has(j.id) && filtered(cards.get(j.id)?.operations.plan.actualOn || cards.get(j.id)?.operations.plan.agreedOn || cards.get(j.id)?.operations.plan.tentativeOn || j.demolitionDate || j.createdAt, j.status, j.deletedAt) && jobExtraMatch(j) && matches(j.customerName, j.customerPhone, j.customerEmail, j.location, j.district, j.id, j.note, j.materialType, j.objectType, cards.get(j.id)?.number, cards.get(j.id)?.operations.note, JSON.stringify(cards.get(j.id)?.operations??{}), ...(manualByJob.get(j.id) ?? []), ...local.jobWorkspace.communications.filter(c => c.jobId === j.id).map(c => `${c.subject} ${c.text}`))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(j => ({
        id: j.id, customerName: j.customerName, location: j.location, demolitionDate: j.demolitionDate, status: j.status, number: cards.get(j.id)?.number, responsibleEmail: cards.get(j.id)?.operations.responsibleEmail, archived: Boolean(j.deletedAt)
    }));
    const generated = local.priceOffers.filter(o => !o.isTestData && !(o.jobId && testJobIds.has(o.jobId)) && !(o.leadId && testLeadIds.has(o.leadId)) && filtered(o.createdAt, o.status, o.deletedAt) && (!options.responsibleEmail || Boolean(o.jobId && cards.get(o.jobId)?.operations.responsibleEmail === options.responsibleEmail)) && (!options.workType || Boolean(o.jobId && jobs.get(o.jobId)?.workType === options.workType)) && matches(o.number, o.contactPerson, o.phone, o.email, o.objectAddress, o.municipality, o.district, o.id, o.offerNote, o.internalNote)).map(o => ({
        id: o.id, number: o.number, contactPerson: o.contactPerson, objectAddress: o.objectAddress, totalWithVat: o.totalWithVat, source: 'GENERATED' as const, status: o.status, jobId: o.jobId, archived: Boolean(o.deletedAt), createdAt: o.createdAt
    }));
    const imported = local.jobWorkspace.manualOffers.filter(o => !(o.jobId && testJobIds.has(o.jobId)) && !(o.leadId && testLeadIds.has(o.leadId)) && filtered(o.issuedOn || o.createdAt, o.status, o.archivedAt, true) && (!options.responsibleEmail || Boolean(o.jobId && cards.get(o.jobId)?.operations.responsibleEmail === options.responsibleEmail)) && (!options.workType || Boolean(o.jobId && jobs.get(o.jobId)?.workType === options.workType)) && matches(o.originalNumber, o.contactPerson, o.email, o.phone, o.address, o.id, o.note, ...o.items.map(i => i.description))).map(o => ({
        id: o.id, number: o.originalNumber, contactPerson: o.contactPerson, objectAddress: o.address, totalWithVat: o.totalWithVatCents === null ? null : o.totalWithVatCents / 100, source: 'MANUAL_PDF' as const, status: o.status, jobId: o.jobId ?? undefined, archived: Boolean(o.archivedAt), createdAt: o.createdAt
    }));
    const offers = [...generated, ...imported].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const reviews = local.reviewRequests.filter(r => !Boolean(r.jobId && testJobIds.has(r.jobId)) && !Boolean(r.leadId && testLeadIds.has(r.leadId)) && filtered(r.createdAt, r.status, r.jobId ? jobs.get(r.jobId)?.deletedAt : null) && !options.responsibleEmail && !options.workType && matches(r.customerName, r.customerEmail, r.phone, r.location, r.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => ({
        id: r.id, customerName: r.customerName, customerEmail: r.customerEmail, phone: r.phone || '', location: r.location || '', status: r.status
    }));
    const finance = includeFinance ? local.businessJobInvoices.filter(i => !testJobIds.has(i.jobId) && filtered(i.issuedOn, '', jobs.get(i.jobId)?.deletedAt) && !options.responsibleEmail && !options.workType && matches(i.invoiceNumber, i.id, i.jobId)).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn)).map(i => ({
        id: i.id, jobId: i.jobId, invoiceNumber: i.invoiceNumber, issuedOn: i.issuedOn, dueOn: i.dueOn || '', amountWithVatCents: i.amountWithVatCents
    })) : [];
    return withPage({
        leads, jobs: foundJobs, offers, reviews, finance
    }, options);
}
/** Matching, counting and paging stay in PostgreSQL. Only the requested safe page leaves it. */
export async function searchJobWorkspacePostgres(db: Pick<Pool, 'query'>, query: string, includeFinance: boolean, rawOptions: JobWorkspaceSearchOptions = {}): Promise<AdminSearchData> {
    const options = optionsNormalized(rawOptions), tokens = adminSearchTokens(query);
    if (tokens.join('').length < 2)
        return withPage({
            leads: [], jobs: [], offers: [], reviews: [], finance: []
        }, options);
    const values = [tokens, options.year ?? null, options.status || null, options.archived, options.responsibleEmail || '', options.workType || '', options.pageSize, (options.page - 1) * options.pageSize];
    const folded = `translate(lower(COALESCE(search_text,'')), 'áäčďéíĺľňóôŕšťúýž', 'aacdeillnoorstuyz')`;
    const tokenMatch = `NOT EXISTS (SELECT 1 FROM unnest($1::text[]) token WHERE strpos(${folded},token)=0 AND (length(regexp_replace(token,'[^a-z0-9]+','','g'))<2 OR strpos(regexp_replace(${folded},'[^a-z0-9]+','','g'),regexp_replace(token,'[^a-z0-9]+','','g'))=0))`;
    const filters = `($2::int IS NULL OR left(year_at,4)=$2::text) AND ($3::text IS NULL OR state=$3) AND ($4::text='include' OR ($4='only' AND archived) OR ($4='exclude' AND NOT archived)) AND ($5::text='' OR responsible=$5) AND ($6::text='' OR work_type=$6) AND ${tokenMatch}`;
    const page = async (source: string) => {
        const result = await db.query(`WITH source AS (${source}), matched AS (SELECT id,data,sort_at FROM source WHERE ${filters}) SELECT (SELECT count(*) FROM matched)::int AS total,COALESCE(jsonb_agg(paged.data ORDER BY paged.sort_at DESC,paged.id DESC),'[]'::jsonb) AS records FROM (SELECT id,data,sort_at FROM matched ORDER BY sort_at DESC,id DESC LIMIT $7 OFFSET $8) paged`, values);
        return { total: Number(result.rows[0]?.total ?? 0), records: result.rows[0]?.records ?? [] };
    };
    const leadSource = `SELECT l.id,l.created_at::text sort_at,l.created_at::text year_at,l.status state,(l.deleted_at IS NOT NULL) archived,''::text responsible,''::text work_type,concat_ws(' ',l.full_name,l.phone,l.email,l.city,l.district,l.id,l.note,l.internal_note,l.material_type,l.object_type) search_text,jsonb_build_object('id',l.id,'fullName',l.full_name,'phone',l.phone,'email',l.email,'city',l.city,'status',l.status) data FROM leads l WHERE NOT COALESCE(l.is_test_data,false)`;
    const jobSource = `SELECT j.id,j.created_at::text sort_at,COALESCE(w.operations->'plan'->>'actualOn',w.operations->'plan'->>'agreedOn',w.operations->'plan'->>'tentativeOn',j.demolition_date::text,j.created_at::text) year_at,j.status state,(j.deleted_at IS NOT NULL) archived,COALESCE(w.operations->>'responsibleEmail','') responsible,COALESCE(j.work_type,w.operations->>'workType') work_type,concat_ws(' ',j.customer_name,j.customer_phone,j.customer_email,j.location,j.district,j.id,j.note,j.material_type,j.object_type,w.number,w.operations::text,w.operations->>'note',(SELECT string_agg(concat_ws(' ',c.data->>'subject',c.data->>'text'),' ') FROM job_workspace_communications c WHERE c.job_id=j.id),(SELECT string_agg(m.data->>'originalNumber',' ') FROM job_workspace_manual_offers m WHERE m.job_id=j.id),(SELECT string_agg(o.number,' ') FROM price_offers o WHERE o.job_id=j.id)) search_text,jsonb_build_object('id',j.id,'customerName',j.customer_name,'location',j.location,'demolitionDate',COALESCE(j.demolition_date::text,''),'status',j.status,'number',w.number,'responsibleEmail',w.operations->>'responsibleEmail','archived',j.deleted_at IS NOT NULL) data FROM business_jobs j LEFT JOIN leads l ON l.id=j.lead_id LEFT JOIN job_workspaces w ON w.job_id=j.id WHERE NOT COALESCE(j.is_test_data,false) AND NOT COALESCE(l.is_test_data,false)`;
    const generatedSource = `SELECT o.id,o.created_at::text sort_at,o.created_at::text year_at,o.status state,(o.deleted_at IS NOT NULL) archived,COALESCE(w.operations->>'responsibleEmail','') responsible,COALESCE(j.work_type,w.operations->>'workType','') work_type,concat_ws(' ',o.number,o.contact_person,o.phone,o.email,o.object_address,o.municipality,o.district,o.id,o.offer_note,o.internal_note) search_text,jsonb_build_object('id',o.id,'number',o.number,'contactPerson',o.contact_person,'objectAddress',o.object_address,'totalWithVat',o.total_with_vat,'source','GENERATED','status',o.status,'jobId',o.job_id,'archived',o.deleted_at IS NOT NULL) data FROM price_offers o LEFT JOIN business_jobs j ON j.id=o.job_id LEFT JOIN leads l ON l.id=o.lead_id LEFT JOIN leads jl ON jl.id=j.lead_id LEFT JOIN job_workspaces w ON w.job_id=j.id WHERE NOT COALESCE(o.is_test_data,false) AND NOT COALESCE(j.is_test_data,false) AND NOT COALESCE(l.is_test_data,false) AND NOT COALESCE(jl.is_test_data,false)`;
    const manualSource = `SELECT m.id,m.data->>'createdAt' sort_at,COALESCE(m.data->>'issuedOn',m.data->>'createdAt') year_at,CASE m.data->>'status' WHEN 'DRAFT' THEN 'PRIPRAVENA' WHEN 'SENT_VERIFIED' THEN 'ODOSLANA' WHEN 'ACCEPTED' THEN 'PRIJATA' WHEN 'DEFERRED' THEN 'ODLOZENA' WHEN 'REJECTED' THEN 'NEUSPESNA' ELSE m.data->>'status' END state,(m.data->>'archivedAt' IS NOT NULL) archived,COALESCE(w.operations->>'responsibleEmail','') responsible,COALESCE(j.work_type,w.operations->>'workType','') work_type,concat_ws(' ',m.data->>'originalNumber',m.data->>'contactPerson',m.data->>'phone',m.data->>'email',m.data->>'address',m.id,m.data->>'note',(SELECT string_agg(item->>'description',' ') FROM jsonb_array_elements(m.data->'items') item)) search_text,jsonb_build_object('id',m.id,'number',m.data->>'originalNumber','contactPerson',m.data->>'contactPerson','objectAddress',m.data->>'address','totalWithVat',(m.data->>'totalWithVatCents')::numeric/100,'source','MANUAL_PDF','status',m.data->>'status','jobId',m.job_id,'archived',m.data->>'archivedAt' IS NOT NULL) data FROM job_workspace_manual_offers m LEFT JOIN business_jobs j ON j.id=m.job_id LEFT JOIN leads l ON l.id=NULLIF(m.data->>'leadId','')::uuid LEFT JOIN leads jl ON jl.id=j.lead_id LEFT JOIN job_workspaces w ON w.job_id=j.id WHERE NOT COALESCE(j.is_test_data,false) AND NOT COALESCE(l.is_test_data,false) AND NOT COALESCE(jl.is_test_data,false)`;
    const reviewSource = `SELECT r.id,r.created_at::text sort_at,r.created_at::text year_at,r.status state,(j.deleted_at IS NOT NULL) archived,''::text responsible,''::text work_type,concat_ws(' ',r.customer_name,r.customer_email,r.phone,r.location,r.id) search_text,jsonb_build_object('id',r.id,'customerName',r.customer_name,'customerEmail',r.customer_email,'phone',COALESCE(r.phone,''),'location',COALESCE(r.location,''),'status',r.status) data FROM review_requests r LEFT JOIN business_jobs j ON j.id=r.job_id LEFT JOIN leads l ON l.id=r.lead_id LEFT JOIN leads jl ON jl.id=j.lead_id WHERE NOT COALESCE(j.is_test_data,false) AND NOT COALESCE(l.is_test_data,false) AND NOT COALESCE(jl.is_test_data,false)`;
    const financeSource = `SELECT i.id,i.issued_on::text sort_at,i.issued_on::text year_at,''::text state,(j.deleted_at IS NOT NULL) archived,''::text responsible,''::text work_type,concat_ws(' ',i.invoice_number,i.id,i.job_id) search_text,jsonb_build_object('id',i.id,'jobId',i.job_id,'invoiceNumber',i.invoice_number,'issuedOn',i.issued_on::text,'dueOn',COALESCE(i.due_on::text,''),'amountWithVatCents',i.amount_with_vat_cents) data FROM business_job_invoices i JOIN business_jobs j ON j.id=i.job_id LEFT JOIN leads l ON l.id=j.lead_id WHERE NOT COALESCE(j.is_test_data,false) AND NOT COALESCE(l.is_test_data,false)`;
    const [leads, jobs, offers, reviews, finance] = await Promise.all([page(leadSource), page(jobSource), page(`${generatedSource} UNION ALL ${manualSource}`), page(reviewSource), includeFinance ? page(financeSource) : Promise.resolve({ total: 0, records: [] })]);
    const totals = {
        leads: leads.total, jobs: jobs.total, offers: offers.total, reviews: reviews.total, finance: finance.total
    }, totalPages = Math.max(1, ...Object.values(totals).map(total => Math.ceil(total / options.pageSize)));
    if (options.page > totalPages)
        return searchJobWorkspacePostgres(db, query, includeFinance, { ...options, page: totalPages });
    return {
        leads: leads.records, jobs: jobs.records, offers: offers.records, reviews: reviews.records, finance: finance.records, pagination: {
            page: options.page, pageSize: options.pageSize, totalPages, totals
        }
    };
}
