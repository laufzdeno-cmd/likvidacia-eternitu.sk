import { projectBusinessJobFinance } from './business-billing';
import type {
  AuditLog,
  BusinessJob,
  BusinessJobCompletion,
  BusinessJobFinance,
  BusinessJobOfferEvidence,
  BusinessJobInvoice,
  BusinessJobPaymentEvent,
  PlannerAction,
  OperationalBusinessJob,
  OperationalBusinessJobCompletion,
  PriceOffer,
  PriceOfferFollowUpHistoryItem,
  ReviewRequest,
} from '../server/types';

export type OperationsTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type ClosureChecklistItem = {
  id: 'offer' | 'realization' | 'invoice' | 'payment' | 'costs' | 'documents' | 'photos' | 'review';
  label: string;
  state: 'done' | 'attention' | 'missing' | 'unknown';
  detail: string;
  href?: string;
};

export type OperationsTimelineItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  category: 'communication' | 'offer' | 'finance' | 'planning' | 'workflow' | 'review';
  tone: OperationsTone;
};

export type JobAttention = {
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  ageDays: number;
};

export type PlannerCollision = {
  actionId: string;
  conflictingActionId: string;
  date: string;
  worker: string;
  detail: string;
};

export type JobAttentionEvidence = {
  hasActivePlannerAction?: boolean;
  hasRecordedFollowUp?: boolean;
};

type JobAttentionJob = Pick<BusinessJob, 'deletedAt' | 'status' | 'updatedAt'>;

export type ReceivableQueueItem = {
  job: BusinessJob;
  finance: BusinessJobFinance;
  invoiceCount: number;
  tone: OperationsTone;
};

const completionStatuses = new Set<BusinessJob['status']>(['DEMONT_DOKONCENA', 'VYUCTOVANIE', 'DOKONCENA']);
const paperworkStatuses = new Set<BusinessJob['status']>([
  'URADY_PODANE', 'URADY_SCHVALENE', 'V_REALIZACII', 'DEMONT_NAPLANOVANA', 'DEMONT_DOKONCENA', 'VYUCTOVANIE', 'DOKONCENA',
]);

function state(done: boolean, attention = false): ClosureChecklistItem['state'] {
  return done ? 'done' : attention ? 'attention' : 'missing';
}

function bratislavaDateTimeIso(date: string, time: string) {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(noonUtc);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localNoonAsUtc = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute));
  const offsetMs = localNoonAsUtc - noonUtc.getTime();
  return new Date(Date.parse(`${date}T${time}:00Z`) - offsetMs).toISOString();
}

export function buildJobClosureChecklist(input: {
  job: BusinessJob;
  offers: PriceOffer[];
  finance: BusinessJobFinance;
  plannerActions: PlannerAction[];
  photoEvidence:
    | { status: 'available'; approvedCount: number; pendingCount: number }
    | { status: 'unknown' };
  reviewRequest?: ReviewRequest;
  completion?: BusinessJobCompletion;
}): ClosureChecklistItem[] {
  const { job, offers, finance, plannerActions, photoEvidence, reviewRequest, completion } = input;
  const acceptedOffer = offers.find((offer) => !offer.deletedAt && offer.status === 'PRIJATA');
  const sentOffer = offers.find((offer) => !offer.deletedAt && ['ODOSLANA', 'NEISTY_STAV'].includes(offer.status));
  const paperworkAction = plannerActions.some((action) => action.type === 'DOKUMENTACIA' && action.status === 'DOKONCENA');
  const activeInvoiceIds = new Set(finance.invoiceBalances.filter((balance) => balance.status !== 'CANCELLED').map((balance) => balance.invoiceId));
  const activeInvoices = finance.invoices.filter((invoice) => activeInvoiceIds.has(invoice.id));
  const invoiced = finance.activeInvoicedCents > 0 && activeInvoices.length > 0;
  const paid = invoiced && finance.outstandingCents === 0 && finance.allocatedReceivedCents > 0;
  const costsEntered = job.costs.total > 0 || job.rewardsTotal > 0;
  const reviewPublished = reviewRequest?.status === 'published';
  const reviewNeedsEditorialStep = Boolean(reviewRequest && ['submitted', 'approved'].includes(reviewRequest.status));
  const reviewFailed = Boolean(reviewRequest && ['delivery_failed', 'cancelled'].includes(reviewRequest.status));
  const reviewUnknown = reviewRequest?.status === 'delivery_unknown';
  const photoState: ClosureChecklistItem['state'] = photoEvidence.status === 'unknown'
    ? 'unknown'
    : state(photoEvidence.approvedCount > 0, photoEvidence.pendingCount > 0);
  const photoDetail = photoEvidence.status === 'unknown'
    ? 'Stav fotodokumentácie sa nepodarilo overiť. Obnovte stránku alebo skontrolujte modul fotografií.'
    : photoEvidence.approvedCount > 0
      ? `Schválené súkromné fotografie: ${photoEvidence.approvedCount}.`
      : photoEvidence.pendingCount > 0
        ? `Na kontrolu čaká ${photoEvidence.pendingCount} fotografií.`
        : 'Chýba schválená fotodokumentácia z realizácie.';

  return [
    {
      id: 'offer', label: 'Cenová ponuka',
      state: state(Boolean(acceptedOffer), Boolean(sentOffer)),
      detail: acceptedOffer ? `Prijatá ponuka ${acceptedOffer.number}.` : sentOffer ? `Ponuka ${sentOffer.number} čaká na potvrdenie.` : 'Chýba prijatá cenová ponuka.',
      href: `/admin/ponuky?jobId=${job.id}`,
    },
    {
      id: 'realization', label: 'Realizácia',
      state: state(completionStatuses.has(job.status), job.status === 'DEMONT_NAPLANOVANA' || job.status === 'V_REALIZACII'),
      detail: completionStatuses.has(job.status) ? 'Demontáž je evidovaná ako dokončená.' : 'Realizácia ešte nie je uzavretá.',
      href: `/admin/planovac?zakazka=${job.id}`,
    },
    {
      id: 'invoice', label: 'Faktúra', state: state(invoiced),
      detail: invoiced ? `Evidovaných aktívnych faktúr: ${activeInvoices.length}.` : 'Nie je zaevidovaná aktívna faktúra.',
      href: '#fakturacia',
    },
    {
      id: 'payment', label: 'Úhrada', state: state(paid, finance.outstandingCents > 0),
      detail: paid ? 'Faktúry sú uhradené.' : finance.overdueCents > 0 ? 'Po splatnosti zostáva neuhradená suma.' : invoiced ? 'Úhrada ešte nie je úplná.' : 'Úhradu možno overiť až po evidencii faktúry.',
      href: '#fakturacia',
    },
    {
      id: 'costs', label: 'Náklady a odmeny', state: completion?.costsDecision === 'confirmed_recorded' || completion?.costsDecision === 'confirmed_zero' ? 'done' : costsEntered ? 'attention' : 'missing',
      detail: completion?.costsDecision === 'confirmed_recorded' ? 'Superadmin potvrdil zaevidované náklady.' : completion?.costsDecision === 'confirmed_zero' ? 'Superadmin potvrdil oprávnené nulové náklady.' : costsEntered ? 'Hodnoty sú zadané, ale ešte nie sú finálne potvrdené.' : 'Náklady ešte nie sú potvrdené.',
      href: '#udaje-zakazky',
    },
    {
      id: 'documents', label: 'Doklady a úrady', state: completion?.documentsDecision === 'confirmed' || completion?.documentsDecision === 'not_applicable' ? 'done' : paperworkStatuses.has(job.status) || paperworkAction ? 'attention' : 'missing',
      detail: completion?.documentsDecision === 'confirmed' ? 'Doklady boli manuálne skontrolované.' : completion?.documentsDecision === 'not_applicable' ? 'Výnimka je manuálne odôvodnená.' : paperworkStatuses.has(job.status) || paperworkAction ? 'Operatívny krok je evidovaný; chýba finálne potvrdenie v sprievodcovi.' : 'Doplňte doklady a potvrďte ich v sprievodcovi.',
      href: `/admin/planovac?zakazka=${job.id}`,
    },
    {
      id: 'photos', label: 'Súkromná fotodokumentácia', state: photoState,
      detail: photoDetail,
      href: '/admin/realizacie/fotky',
    },
    {
      id: 'review', label: 'Referencia', state: reviewPublished ? 'done' : reviewFailed ? 'missing' : reviewRequest ? 'attention' : 'missing',
      detail: reviewPublished
        ? 'Referencia bola po kontrole publikovaná.'
        : reviewNeedsEditorialStep
          ? reviewRequest?.status === 'submitted' ? 'Referencia bola prijatá a čaká na obsahovú kontrolu.' : 'Referencia je schválená a čaká na samostatné publikovanie.'
        : reviewRequest?.status === 'delivery_failed'
          ? 'Doručenie žiadosti zlyhalo. Skontrolujte adresu a postupujte manuálne.'
          : reviewRequest?.status === 'cancelled'
            ? 'Žiadosť bola zrušená. Ďalšie oslovenie najprv manuálne preverte v pracovisku Referencie.'
            : reviewUnknown
              ? 'Výsledok doručenia nie je potvrdený. Pred opakovaním skontrolujte odoslanú poštu.'
              : reviewRequest
                ? 'Žiadosť bola vytvorená, čakáme na reakciu.'
                : 'Žiadosť o referenciu ešte nebola vytvorená.',
      href: '/admin/referencie',
    },
  ];
}

const actionLabels: Record<string, string> = {
  business_job_lead_received: 'Dopyt prijatý',
  business_job_created: 'Zákazka vytvorená',
  business_job_updated: 'Údaje zákazky upravené',
  business_job_status_changed: 'Stav zákazky zmenený',
  business_job_quote_sent: 'Cenová ponuka odoslaná',
  business_job_note_added: 'Interná poznámka',
  business_invoice_recorded: 'Faktúra zaevidovaná',
  business_invoice_cancelled: 'Faktúra stornovaná',
  business_payment_recorded: 'Úhrada zaevidovaná',
  business_payment_reversed: 'Úhrada stornovaná',
};

export type OfferFollowUpTimelineItem = Pick<PriceOfferFollowUpHistoryItem,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'subject'
> & { offerNumber: string };

const financialAuditActions = new Set([
  'business_invoice_recorded',
  'business_invoice_cancelled',
  'business_payment_recorded',
  'business_payment_reversed',
]);

function isOfferFollowUpAudit(action: string) {
  return action.startsWith('price_offer_follow_up_');
}

function followUpTimelineItem(followUp: OfferFollowUpTimelineItem): OperationsTimelineItem {
  const result = followUp.status === 'sent'
    ? 'Email bol odoslaný.'
    : followUp.status === 'failed'
      ? 'Email sa neodoslal. Skontrolujte chybu pred novým pokusom.'
      : followUp.status === 'unknown'
        ? 'Výsledok doručenia nie je potvrdený. Pred opakovaním overte odoslanú poštu.'
        : 'Odosielanie bolo začaté a ešte nemá potvrdený výsledok.';
  return {
    id: `offer-follow-up-${followUp.id}`,
    at: followUp.updatedAt || followUp.createdAt,
    title: `Follow-up ponuky ${followUp.offerNumber}`,
    detail: `Predmet: ${followUp.subject || 'bez predmetu'} · Stav: ${result}`,
    category: 'communication',
    tone: followUp.status === 'sent' ? 'success' : followUp.status === 'failed' ? 'danger' : 'warning',
  };
}

export function buildOperationsTimeline(input: {
  auditLogs: AuditLog[];
  offers: PriceOffer[];
  finance: BusinessJobFinance;
  plannerActions: PlannerAction[];
  followUps?: OfferFollowUpTimelineItem[];
  emailDeliveries?: Array<{ recipientRole: string; status: string; updatedAt: string; attempts: number }>;
  reviewRequest?: ReviewRequest;
}): OperationsTimelineItem[] {
  const items: OperationsTimelineItem[] = input.auditLogs.filter((log) => !isOfferFollowUpAudit(log.action)).map((log) => ({
    id: `audit-${log.id}`,
    at: log.createdAt,
    title: actionLabels[log.action] || 'Aktivita zákazky',
    detail: log.changes.note ? String(log.changes.note) : log.action === 'business_job_status_changed'
      ? `${String(log.changes.previous || '')} → ${String(log.changes.next || '')}` : log.actorEmail,
    category: log.action.includes('invoice') || log.action.includes('payment') ? 'finance'
      : log.action.includes('quote') ? 'offer' : log.action.includes('note') ? 'communication' : 'workflow',
    tone: log.action.includes('cancelled') || log.action.includes('reversed') ? 'warning' : 'neutral',
  }));

  for (const offer of input.offers) {
    items.push({
      id: `offer-created-${offer.id}`, at: offer.createdAt, title: `Cenová ponuka ${offer.number} vytvorená`,
      detail: `${offer.contactPerson} · ${offer.municipality || offer.objectAddress}`, category: 'offer', tone: 'info',
    });
    if (offer.sentAt) items.push({ id: `offer-sent-${offer.id}`, at: offer.sentAt, title: `Ponuka ${offer.number} odoslaná`, detail: offer.email, category: 'offer', tone: 'success' });
    if (offer.acceptedAt) items.push({ id: `offer-accepted-${offer.id}`, at: offer.acceptedAt, title: `Ponuka ${offer.number} prijatá`, detail: 'Prijatie bolo potvrdené v CRM.', category: 'offer', tone: 'success' });
  }
  for (const invoice of input.finance.invoices) {
    items.push({ id: `invoice-${invoice.id}`, at: invoice.createdAt, title: `Faktúra ${invoice.invoiceNumber}`, detail: invoice.cancelledAt ? 'Stornovaná faktúra.' : `Splatnosť ${invoice.dueOn || 'nezadaná'}.`, category: 'finance', tone: invoice.cancelledAt ? 'warning' : 'info' });
  }
  for (const payment of input.finance.paymentEvents) {
    items.push({ id: `payment-${payment.id}`, at: payment.createdAt, title: payment.eventType === 'RECEIPT' ? 'Prijatá úhrada' : 'Storno úhrady', detail: payment.reference || payment.method, category: 'finance', tone: payment.eventType === 'RECEIPT' ? 'success' : 'warning' });
  }
  for (const action of input.plannerActions) {
    items.push({ id: `planner-${action.id}`, at: bratislavaDateTimeIso(action.date, action.timeFrom), title: action.type === 'DEMONTAZ' ? 'Naplánovaná demontáž' : action.type === 'ODVOZ' ? 'Naplánovaný odvoz' : action.type === 'DOKUMENTACIA' ? 'Dokumentačný krok' : 'Naplánovaná akcia', detail: `${action.timeFrom}–${action.timeTo} · ${action.address} · ${action.workers || 'bez tímu'}`, category: 'planning', tone: action.status === 'ZRUSENA' ? 'warning' : action.status === 'DOKONCENA' ? 'success' : 'info' });
  }
  for (const followUp of input.followUps || []) items.push(followUpTimelineItem(followUp));
  for (const email of input.emailDeliveries || []) {
    items.push({ id: `mail-${email.recipientRole}`, at: email.updatedAt, title: email.recipientRole === 'customer' ? 'Email zákazníkovi' : 'Interný email', detail: `Stav: ${email.status} · pokusy: ${email.attempts}`, category: 'communication', tone: email.status === 'sent' ? 'success' : email.status === 'failed' || email.status === 'unknown' ? 'danger' : 'info' });
  }
  if (input.reviewRequest) {
    const received = ['submitted', 'approved', 'published'].includes(input.reviewRequest.status);
    const failed = ['delivery_failed', 'cancelled'].includes(input.reviewRequest.status);
    const unknown = input.reviewRequest.status === 'delivery_unknown';
    items.push({
      id: `review-${input.reviewRequest.id}`,
      at: input.reviewRequest.updatedAt,
      title: received ? 'Referencia prijatá' : failed ? 'Žiadosť o referenciu vyžaduje zásah' : unknown ? 'Doručenie žiadosti nie je potvrdené' : 'Žiadosť o referenciu',
      detail: input.reviewRequest.location || input.reviewRequest.customerName,
      category: 'review',
      tone: received ? 'success' : failed ? 'danger' : unknown ? 'warning' : 'info',
    });
  }

  const unique = new Map<string, OperationsTimelineItem>();
  for (const item of items) unique.set(`${item.at}|${item.title}|${item.detail}`, item);
  return [...unique.values()].sort((a, b) => b.at.localeCompare(a.at));
}

export function buildOperationalJobChecklist(input: {
  job: OperationalBusinessJob;
  offers: BusinessJobOfferEvidence[];
  plannerActions: PlannerAction[];
  photoEvidence:
    | { status: 'available'; approvedCount: number; pendingCount: number }
    | { status: 'unknown' };
  reviewRequest?: ReviewRequest;
  completion?: OperationalBusinessJobCompletion;
}): ClosureChecklistItem[] {
  const { job, offers, plannerActions, photoEvidence, reviewRequest, completion } = input;
  const acceptedOffer = offers.find((offer) => !offer.deletedAt && offer.status === 'PRIJATA');
  const sentOffer = offers.find((offer) => !offer.deletedAt && ['ODOSLANA', 'NEISTY_STAV'].includes(offer.status));
  const paperworkAction = plannerActions.some((action) => action.type === 'DOKUMENTACIA' && action.status === 'DOKONCENA');
  const reviewPublished = reviewRequest?.status === 'published';
  const reviewNeedsEditorialStep = Boolean(reviewRequest && ['submitted', 'approved'].includes(reviewRequest.status));
  const reviewFailed = Boolean(reviewRequest && ['delivery_failed', 'cancelled'].includes(reviewRequest.status));
  const photoState: ClosureChecklistItem['state'] = photoEvidence.status === 'unknown'
    ? 'unknown'
    : state(photoEvidence.approvedCount > 0, photoEvidence.pendingCount > 0);
  return [
    {
      id: 'offer', label: 'Cenová ponuka',
      state: state(Boolean(acceptedOffer), Boolean(sentOffer)),
      detail: acceptedOffer ? `Prijatá ponuka ${acceptedOffer.number}.` : sentOffer ? `Ponuka ${sentOffer.number} čaká na potvrdenie.` : 'Chýba prijatá cenová ponuka.',
      href: `/admin/ponuky?jobId=${job.id}`,
    },
    {
      id: 'realization', label: 'Realizácia',
      state: state(completionStatuses.has(job.status), job.status === 'DEMONT_NAPLANOVANA' || job.status === 'V_REALIZACII'),
      detail: completionStatuses.has(job.status) ? 'Demontáž je evidovaná ako dokončená.' : 'Realizácia ešte nie je uzavretá.',
      href: `/admin/planovac?zakazka=${job.id}`,
    },
    {
      id: 'documents', label: 'Doklady a úrady', state: completion?.documentsDecision === 'confirmed' || completion?.documentsDecision === 'not_applicable' ? 'done' : paperworkStatuses.has(job.status) || paperworkAction ? 'attention' : 'missing',
      detail: completion?.documentsDecision === 'confirmed' ? 'Doklady boli manuálne skontrolované.' : completion?.documentsDecision === 'not_applicable' ? 'Výnimka je manuálne odôvodnená.' : paperworkStatuses.has(job.status) || paperworkAction ? 'Operatívny krok je evidovaný; chýba finálne potvrdenie v sprievodcovi.' : 'Doplňte doklady a potvrďte ich v sprievodcovi.',
      href: `/admin/planovac?zakazka=${job.id}`,
    },
    {
      id: 'photos', label: 'Súkromná fotodokumentácia', state: photoState,
      detail: photoEvidence.status === 'unknown'
        ? 'Stav fotodokumentácie sa nepodarilo overiť.'
        : photoEvidence.approvedCount > 0
          ? `Schválené súkromné fotografie: ${photoEvidence.approvedCount}.`
          : photoEvidence.pendingCount > 0
            ? `Na kontrolu čaká ${photoEvidence.pendingCount} fotografií.`
            : 'Chýba schválená fotodokumentácia z realizácie.',
      href: '/admin/realizacie/fotky',
    },
    {
      id: 'review', label: 'Referencia', state: reviewPublished ? 'done' : reviewFailed ? 'missing' : reviewRequest ? 'attention' : 'missing',
      detail: reviewPublished ? 'Referencia bola po kontrole publikovaná.' : reviewNeedsEditorialStep ? reviewRequest?.status === 'submitted' ? 'Referencia čaká na obsahovú kontrolu.' : 'Schválená referencia čaká na publikovanie.' : reviewFailed ? 'Žiadosť o referenciu vyžaduje zásah.' : reviewRequest ? 'Žiadosť je evidovaná, čakáme na reakciu.' : 'Žiadosť o referenciu ešte nebola vytvorená.',
      href: '/admin/referencie',
    },
  ];
}

export function buildOperationalTimeline(input: {
  auditLogs: AuditLog[];
  offers: BusinessJobOfferEvidence[];
  plannerActions: PlannerAction[];
  followUps?: OfferFollowUpTimelineItem[];
  emailDeliveries?: Array<{ recipientRole: string; status: string; updatedAt: string; attempts: number }>;
  reviewRequest?: ReviewRequest;
}): OperationsTimelineItem[] {
  const items: OperationsTimelineItem[] = input.auditLogs
    .filter((log) => !financialAuditActions.has(log.action) && !isOfferFollowUpAudit(log.action))
    .map((log) => ({
    id: `audit-${log.id}`,
    at: log.createdAt,
    title: actionLabels[log.action] || 'Aktivita zákazky',
    detail: log.changes.note ? String(log.changes.note) : log.action === 'business_job_status_changed'
      ? `${String(log.changes.previous || '')} → ${String(log.changes.next || '')}` : 'Zmena je zaevidovaná v CRM.',
    category: log.action.includes('quote') ? 'offer' : log.action.includes('note') ? 'communication' : 'workflow',
    tone: 'neutral',
  }));
  for (const offer of input.offers) {
    items.push({ id: `offer-created-${offer.id}`, at: offer.createdAt, title: `Cenová ponuka ${offer.number} vytvorená`, detail: 'Ponuka je evidovaná pri zákazke.', category: 'offer', tone: 'info' });
    if (offer.sentAt) items.push({ id: `offer-sent-${offer.id}`, at: offer.sentAt, title: `Ponuka ${offer.number} odoslaná`, detail: 'Odoslanie bolo zaevidované.', category: 'offer', tone: 'success' });
    if (offer.acceptedAt) items.push({ id: `offer-accepted-${offer.id}`, at: offer.acceptedAt, title: `Ponuka ${offer.number} prijatá`, detail: 'Prijatie bolo potvrdené v CRM.', category: 'offer', tone: 'success' });
  }
  for (const action of input.plannerActions) {
    items.push({ id: `planner-${action.id}`, at: bratislavaDateTimeIso(action.date, action.timeFrom), title: action.type === 'DEMONTAZ' ? 'Naplánovaná demontáž' : action.type === 'ODVOZ' ? 'Naplánovaný odvoz' : action.type === 'DOKUMENTACIA' ? 'Dokumentačný krok' : 'Naplánovaná akcia', detail: `${action.timeFrom}–${action.timeTo} · ${action.address} · ${action.workers || 'bez tímu'}`, category: 'planning', tone: action.status === 'ZRUSENA' ? 'warning' : action.status === 'DOKONCENA' ? 'success' : 'info' });
  }
  for (const followUp of input.followUps || []) items.push(followUpTimelineItem(followUp));
  for (const email of input.emailDeliveries || []) {
    items.push({ id: `mail-${email.recipientRole}`, at: email.updatedAt, title: email.recipientRole === 'customer' ? 'Email zákazníkovi' : 'Interný email', detail: `Stav: ${email.status} · pokusy: ${email.attempts}`, category: 'communication', tone: email.status === 'sent' ? 'success' : email.status === 'failed' || email.status === 'unknown' ? 'danger' : 'info' });
  }
  if (input.reviewRequest) {
    const received = ['submitted', 'approved', 'published'].includes(input.reviewRequest.status);
    const failed = ['delivery_failed', 'cancelled'].includes(input.reviewRequest.status);
    items.push({ id: `review-${input.reviewRequest.id}`, at: input.reviewRequest.updatedAt, title: received ? 'Referencia prijatá' : failed ? 'Žiadosť o referenciu vyžaduje zásah' : 'Žiadosť o referenciu', detail: 'Stav žiadosti je zaevidovaný v CRM.', category: 'review', tone: received ? 'success' : failed ? 'danger' : 'info' });
  }
  const unique = new Map<string, OperationsTimelineItem>();
  for (const item of items) unique.set(`${item.at}|${item.title}|${item.detail}`, item);
  return [...unique.values()].sort((a, b) => b.at.localeCompare(a.at));
}

function calendarDaysBetween(older: string, newer: string) {
  const a = Date.parse(older);
  const b = Date.parse(newer);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

export function getJobAttention(job: JobAttentionJob, nowIso = new Date().toISOString(), evidence: JobAttentionEvidence = {}): JobAttention | null {
  if (job.deletedAt || ['DOKONCENA', 'ZRUSENA'].includes(job.status)) return null;
  if (job.status === 'URADY_SCHVALENE' && evidence.hasActivePlannerAction) return null;
  if (job.status === 'PONUKA_ODOSLANA' && evidence.hasRecordedFollowUp) return null;
  const ageDays = calendarDaysBetween(job.updatedAt, nowIso);
  const thresholds: Partial<Record<BusinessJob['status'], { days: number; title: string; detail: string }>> = {
    DOPYT: { days: 2, title: 'Dopyt bez posunu', detail: 'Skontrolujte kontakt a určte ďalší krok.' },
    DOPYT_PRIJATY: { days: 2, title: 'Dopyt čaká na spracovanie', detail: 'Priraďte zodpovednosť alebo pripravte ponuku.' },
    PONUKA_ODOSLANA: { days: 3, title: 'Ponuka je dlhšie bez zmeny stavu', detail: 'Overte históriu komunikácie a podľa výsledku pripravte alebo zaevidujte follow-up.' },
    PONUKA_POTVRDENA: { days: 5, title: 'Potvrdená ponuka bez administratívneho posunu', detail: 'Skontrolujte podklady a termíny úradov.' },
    URADY_PODANE: { days: 14, title: 'Konanie na úradoch treba preveriť', detail: 'Overte stav podania a zapíšte výsledok.' },
    URADY_SCHVALENE: { days: 5, title: 'Schválená zákazka je dlhšie bez zmeny stavu', detail: 'Overte, či je termín a tím už evidovaný; ak nie, doplňte ich v plánovači.' },
    V_REALIZACII: { days: 3, title: 'Realizácia nemá čerstvú aktualizáciu', detail: 'Overte stav prác, fotografie a ďalší krok.' },
    DEMONT_DOKONCENA: { days: 2, title: 'Demontáž čaká na vyúčtovanie', detail: 'Doplňte náklady, faktúru a úhradu.' },
    VYUCTOVANIE: { days: 5, title: 'Vyúčtovanie nie je uzavreté', detail: 'Skontrolujte faktúru, platbu a uzatvárací checklist.' },
  };
  const rule = thresholds[job.status];
  if (!rule || ageDays < rule.days) return null;
  return { severity: ageDays >= rule.days * 2 ? 'critical' : 'warning', title: rule.title, detail: rule.detail, ageDays };
}

function overlaps(left: PlannerAction, right: PlannerAction) {
  return left.date === right.date && left.timeFrom < right.timeTo && right.timeFrom < left.timeTo;
}

function splitWorkers(value: string) {
  return value.split(',').map((worker) => worker.trim()).filter(Boolean);
}

export function findPlannerCollisions(actions: PlannerAction[]): PlannerCollision[] {
  const active = actions.filter((action) => !['ZRUSENA', 'PRESUNUTA'].includes(action.status));
  const collisions: PlannerCollision[] = [];
  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const left = active[leftIndex];
      const right = active[rightIndex];
      if (!overlaps(left, right)) continue;
      const rightWorkers = new Set(splitWorkers(right.workers));
      for (const worker of splitWorkers(left.workers)) {
        if (!rightWorkers.has(worker)) continue;
        collisions.push({
          actionId: left.id, conflictingActionId: right.id, date: left.date, worker,
          detail: `${left.timeFrom}–${left.timeTo} sa prekrýva s ${right.timeFrom}–${right.timeTo}.`,
        });
      }
    }
  }
  return collisions;
}

export function buildReceivableQueue(
  jobs: BusinessJob[],
  invoices: BusinessJobInvoice[],
  paymentEvents: BusinessJobPaymentEvent[],
  today: string,
): ReceivableQueueItem[] {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const jobIds = new Set([...invoices.map((invoice) => invoice.jobId), ...paymentEvents.map((event) => event.jobId)]);
  const queue: ReceivableQueueItem[] = [];
  for (const jobId of jobIds) {
    const job = jobById.get(jobId);
    if (!job || job.deletedAt || job.isTestData) continue;
    const jobInvoices = invoices.filter((invoice) => invoice.jobId === jobId);
    const jobEvents = paymentEvents.filter((event) => event.jobId === jobId);
    const finance = projectBusinessJobFinance(jobInvoices, jobEvents, today);
    if (!finance.outstandingCents && !finance.requiresReview && !finance.unallocatedReceivedCents && !finance.overpaidCents) continue;
    queue.push({
      job,
      finance,
      invoiceCount: jobInvoices.filter((invoice) => !invoice.cancelledAt).length,
      tone: finance.overdueCents > 0 || finance.requiresReview ? 'danger' : finance.outstandingCents > 0 ? 'warning' : 'info',
    });
  }
  return queue.sort((a, b) => {
    const criticalDifference = Number(b.tone === 'danger') - Number(a.tone === 'danger');
    if (criticalDifference) return criticalDifference;
    const dueDifference = (a.finance.oldestDueOn || '9999').localeCompare(b.finance.oldestDueOn || '9999');
    return dueDifference || b.finance.outstandingCents - a.finance.outstandingCents;
  });
}

export function buildOfferFollowUpDraft(offer: PriceOffer, today: string) {
  const firstName = offer.contactPerson.trim().split(/\s+/)[0] || 'Dobrý deň';
  const subject = `Cenová ponuka ${offer.number} – krátke overenie`;
  const validity = offer.validUntil >= today ? `Ponuka je platná do ${offer.validUntil}.` : `Platnosť ponuky bola do ${offer.validUntil}; ak je zákazka stále aktuálna, pripravíme vám aktualizáciu.`;
  const body = `Dobrý deň ${firstName},\n\nchcem si overiť, či ste mali možnosť pozrieť si cenovú ponuku ${offer.number} na likvidáciu azbestu v lokalite ${offer.municipality || offer.objectAddress}.\n\n${validity}\n\nAk máte otázku alebo potrebujete upraviť rozsah, odpovedzte na tento email. Pred realizáciou vždy potvrdíme presný rozsah aj termín.\n\nS pozdravom\ntím ASTANA`;
  return { subject, body };
}
