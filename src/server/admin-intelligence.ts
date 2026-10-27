import 'server-only';

import { projectBusinessJobFinance } from '@/src/lib/business-billing';
import { businessPeriodBounds, businessTodayKey } from '@/src/lib/business-period';
import type { AdminRole, BusinessJob, OperationalBusinessJob, PlannerAction, PriceOffer } from './types';
import {
  getOperationalFunnelEventMetrics,
  listBusinessFinanceEvidence,
  listBusinessJobs,
  listOperationalBusinessJobs,
  listEligibleReviewJobs,
  getLeadDashboardMetrics,
  getPriceOfferEventMetrics,
  getReviewRequestEventMetrics,
  listLeads,
  listPlannerActions,
  listPhotoIntakeRecords,
  listPriceOffers,
  listRealizationCaseDrafts,
  listRealizations,
  listReviewRequests,
  listOperationalWorkers,
  listWorkers,
  searchAdminData,
} from './db';

const activeJobStatuses = new Set(['DOPYT', 'DOPYT_PRIJATY', 'PONUKA_ODOSLANA', 'PRIJATA', 'PONUKA_POTVRDENA', 'URADY_PODANE', 'URADY_SCHVALENE', 'V_REALIZACII', 'DEMONT_NAPLANOVANA', 'DEMONT_DOKONCENA', 'VYUCTOVANIE']);
const completedJobStatuses = new Set(['DOKONCENA']);

function isFinancialBusinessJob(job: BusinessJob | OperationalBusinessJob): job is BusinessJob {
  return 'totalPrice' in job && typeof job.totalPrice === 'number';
}

function daysBefore(date: Date, days: number) {
  return new Date(date.getTime() - days * 86_400_000).toISOString();
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function effectiveOfferDate(offer: PriceOffer) {
  return offer.sentAt || offer.createdAt;
}

function splitWorkers(value: string) {
  return value.split(/[,;\n]+/).map((item) => item.trim().toLocaleLowerCase('sk')).filter(Boolean);
}

function timeMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function actionsOverlap(left: PlannerAction, right: PlannerAction) {
  const leftStart = timeMinutes(left.timeFrom);
  const rightStart = timeMinutes(right.timeFrom);
  if (leftStart === null || rightStart === null) return false;
  const leftEnd = timeMinutes(left.timeTo) ?? leftStart + 60;
  const rightEnd = timeMinutes(right.timeTo) ?? rightStart + 60;
  return leftStart < rightEnd && rightStart < leftEnd;
}

function hasSharedWorker(left: PlannerAction, right: PlannerAction) {
  const rightWorkers = new Set(splitWorkers(right.workers));
  return splitWorkers(left.workers).some((worker) => rightWorkers.has(worker));
}

function freeWorkdays(from: string, to: string, actions: PlannerAction[]) {
  const occupied = new Set(actions.filter((action) => !['ZRUSENA', 'PRESUNUTA'].includes(action.status)).map((action) => action.date));
  const days: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    const weekday = new Date(`${cursor}T12:00:00.000Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !occupied.has(cursor)) days.push(cursor);
  }
  return days;
}

export type AdminOperationsOverview = Awaited<ReturnType<typeof getAdminOperationsOverview>>;

export type AdminApprovalQueueItem = {
  id: string;
  category: 'offer_approval' | 'offer_outcome' | 'review_send' | 'review_reminder' | 'review_moderation' | 'delivery_resolution' | 'photo_review' | 'case_draft' | 'case_approval' | 'case_publication' | 'realization_publication';
  title: string;
  detail: string;
  createdAt: string;
  href: string;
  urgency: 'critical' | 'attention' | 'normal';
};

export async function getAdminApprovalQueue(role: AdminRole, now = new Date()) {
  if (role !== 'SUPER_ADMIN') throw new Error('Schvaľovacia fronta je dostupná iba superadminovi.');
  const nowIso = now.toISOString();
  const [offerResult, reviewResult, caseResult, photoResult, realizationResult] = await Promise.allSettled([
    listPriceOffers(),
    listReviewRequests(),
    listRealizationCaseDrafts(),
    listPhotoIntakeRecords({ pendingOnly: true, page: 1, pageSize: 100 }),
    listRealizations(),
  ]);
  const unavailableSources: string[] = [];
  const items: AdminApprovalQueueItem[] = [];
  if (offerResult.status === 'rejected') unavailableSources.push('cenové ponuky');
  else for (const offer of offerResult.value.filter((item) => !item.deletedAt && !item.isTestData)) {
    const shortNumber = offer.number || offer.id.slice(0, 8);
    if (offer.status === 'PRIPRAVENA') items.push({
      id: `offer-approve-${offer.id}`, category: 'offer_approval', title: `Skontrolovať a odoslať CP ${shortNumber}`,
      detail: 'Asistent pripravil cenu, PDF aj sprievodný list. Pred odoslaním skontrolujte všetky obchodné údaje.',
      createdAt: offer.createdAt, href: `/admin/ponuky/${offer.id}?send=1`, urgency: 'attention',
    });
    if (offer.status === 'NEISTY_STAV' || (offer.status === 'ODOSIELA' && offer.sendStartedAt && offer.sendStartedAt <= daysBefore(now, 1))) items.push({
      id: `offer-delivery-${offer.id}`, category: 'delivery_resolution', title: `Overiť odoslanie CP ${shortNumber}`,
      detail: 'Výsledok odoslania nie je spoľahlivo potvrdený. Bez kontroly schránky ponuku neposielajte znova.',
      createdAt: offer.sendStartedAt || offer.createdAt, href: `/admin/ponuky/${offer.id}`, urgency: 'critical',
    });
    if (offer.status === 'ODOSLANA' && effectiveOfferDate(offer) <= daysBefore(now, 5)) items.push({
      id: `offer-outcome-${offer.id}`, category: 'offer_outcome', title: `Zistiť výsledok CP ${shortNumber}`,
      detail: 'Ponuka čaká najmenej päť dní. Skontrolujte históriu komunikácie a zaevidujte prijatie, odloženie či neúspech. Systém dovolí najviac jednu odoslanú pripomienku.',
      createdAt: effectiveOfferDate(offer), href: `/admin/ponuky/${offer.id}`, urgency: 'attention',
    });
    if (offer.status === 'ODLOZENA' && offer.nextFollowUpAt && offer.nextFollowUpAt <= businessTodayKey(now)) items.push({
      id: `offer-deferred-${offer.id}`, category: 'offer_outcome', title: `Vrátiť sa k odloženej CP ${shortNumber}`,
      detail: offer.outcomeReason || 'Nastal uložený dátum ďalšieho kontaktu.',
      createdAt: offer.outcomeUpdatedAt || offer.createdAt, href: `/admin/ponuky/${offer.id}`, urgency: 'attention',
    });
  }
  if (reviewResult.status === 'rejected') unavailableSources.push('žiadosti o referencie');
  else for (const request of reviewResult.value) {
    const shortId = request.id.slice(0, 8);
    const base = { createdAt: request.updatedAt, href: '/admin/referencie' };
    if (request.status === 'pending_approval' || request.status === 'delivery_failed') items.push({
      ...base, id: `review-send-${request.id}`, category: 'review_send', title: `Schváliť odoslanie žiadosti #${shortId}`,
      detail: request.status === 'delivery_failed' ? 'Pred ďalším pokusom treba preveriť zlyhanie a ručne schváliť opakovanie.' : 'Text a adresáta musí pred odoslaním skontrolovať superadmin.',
      urgency: request.status === 'delivery_failed' ? 'attention' : 'normal',
    });
    if (request.status === 'delivery_unknown' || request.reminderStatus === 'delivery_unknown') items.push({
      ...base, id: `delivery-${request.id}`, category: 'delivery_resolution', title: `Vyriešiť neznámy výsledok #${shortId}`,
      detail: 'Najprv overte schránku a poskytovateľa. Bez dôkazu správu neposielajte znova.', urgency: 'critical',
    });
    if (request.reminderAllowed && request.reminderDueAt && request.reminderDueAt <= nowIso && !request.reminderAttemptedAt && !request.reminderStatus && ['smtp_accepted', 'opened'].includes(request.status)) items.push({
      ...base, id: `reminder-${request.id}`, category: 'review_reminder', title: `Vopred povolená pripomienka je splatná #${shortId}`,
      detail: 'Chránená plánovaná úloha ju môže automaticky odoslať podľa uloženého povolenia. Overte stav a zasahujte iba pri chybe alebo neznámom výsledku.', createdAt: request.reminderDueAt, urgency: 'attention',
    });
    if (request.status === 'submitted') items.push({
      ...base, id: `moderate-${request.id}`, category: 'review_moderation', title: `Skontrolovať prijatú referenciu #${shortId}`,
      detail: 'Pred schválením treba overiť obsah, súhlas a absenciu nepotrebných osobných údajov.', urgency: 'attention',
    });
    if (request.status === 'approved') items.push({
      ...base, id: `publish-review-${request.id}`, category: 'review_moderation', title: `Rozhodnúť o publikovaní referencie #${shortId}`,
      detail: 'Referencia je schválená, ale zverejnenie zostáva samostatným manuálnym krokom.', urgency: 'normal',
    });
  }
  if (caseResult.status === 'rejected') unavailableSources.push('koncepty realizácií');
  else for (const draft of caseResult.value) {
    if (draft.lifecycle === 'draft') items.push({ id: `case-draft-${draft.id}`, category: 'case_draft', title: `Dokončiť koncept realizácie #${draft.id.slice(0, 8)}`, detail: 'Asistent pripojil schválené fotky a bezpečné základné údaje. Doplňte text a potvrďte presnosť lokality.', createdAt: draft.updatedAt, href: `/admin/realizacie/pripady?id=${draft.id}`, urgency: 'normal' });
    if (draft.lifecycle === 'reviewed') items.push({ id: `case-approve-${draft.id}`, category: 'case_approval', title: `Schváliť prípad #${draft.id.slice(0, 8)}`, detail: 'Koncept prešiel redakčnou kontrolou a čaká na potvrdenie práv, lokality a obsahu.', createdAt: draft.updatedAt, href: `/admin/realizacie/pripady?id=${draft.id}`, urgency: 'attention' });
    if (draft.lifecycle === 'approved') items.push({ id: `case-publish-${draft.id}`, category: 'case_publication', title: `Rozhodnúť o publikovaní prípadu #${draft.id.slice(0, 8)}`, detail: 'Prípad je schválený, ale zatiaľ nie je verejný.', createdAt: draft.updatedAt, href: `/admin/realizacie/pripady?id=${draft.id}`, urgency: 'normal' });
  }
  if (photoResult.status === 'rejected') unavailableSources.push('fotografie z terénu');
  else for (const photo of photoResult.value.records) items.push({ id: `photo-${photo.id}`, category: 'photo_review', title: `Skontrolovať súkromnú fotografiu #${photo.id.slice(0, 8)}`, detail: 'Pred ďalším použitím treba overiť bezpečnosť súboru, lokalitu a kategóriu.', createdAt: photo.uploadedAt || photo.createdAt, href: '/admin/realizacie/fotky', urgency: 'attention' });
  if (realizationResult.status === 'rejected') unavailableSources.push('galéria realizácií');
  else for (const realization of realizationResult.value.filter((item) => item.status === 'draft')) items.push({ id: `realization-${realization.id}`, category: 'realization_publication', title: `Skontrolovať realizáciu #${realization.id.slice(0, 8)}`, detail: 'Rozpracovaná položka čaká na kontrolu fotografií, lokality a podkladu na zverejnenie.', createdAt: realization.updatedAt, href: '/admin/realizacie', urgency: 'normal' });

  const urgencyRank = { critical: 0, attention: 1, normal: 2 } as const;
  items.sort((left, right) => urgencyRank[left.urgency] - urgencyRank[right.urgency] || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const counts = items.reduce<Record<AdminApprovalQueueItem['category'], number>>((totals, item) => {
    totals[item.category] += 1;
    return totals;
  }, { offer_approval: 0, offer_outcome: 0, review_send: 0, review_reminder: 0, review_moderation: 0, delivery_resolution: 0, photo_review: 0, case_draft: 0, case_approval: 0, case_publication: 0, realization_publication: 0 });
  return { generatedAt: nowIso, items, counts, unavailableSources };
}

export async function getAdminOperationalApprovalQueue(now = new Date()) {
  const nowIso = now.toISOString();
  const [offerResult, reviewResult] = await Promise.allSettled([listPriceOffers(), listReviewRequests()]);
  const unavailableSources: string[] = [];
  const items: AdminApprovalQueueItem[] = [];
  if (offerResult.status === 'rejected') unavailableSources.push('cenové ponuky');
  else for (const offer of offerResult.value.filter((item) => !item.deletedAt && !item.isTestData)) {
    const shortNumber = offer.number || offer.id.slice(0, 8);
    if (offer.status === 'PRIPRAVENA') items.push({
      id: `offer-approve-${offer.id}`, category: 'offer_approval', title: `Skontrolovať a odoslať CP ${shortNumber}`,
      detail: 'Skontrolujte cenu, rozsah, dopravu, termín, PDF aj sprievodný list.',
      createdAt: offer.createdAt, href: `/admin/ponuky/${offer.id}?send=1`, urgency: 'attention',
    });
    if (offer.status === 'NEISTY_STAV' || (offer.status === 'ODOSIELA' && offer.sendStartedAt && offer.sendStartedAt <= daysBefore(now, 1))) items.push({
      id: `offer-delivery-${offer.id}`, category: 'delivery_resolution', title: `Overiť odoslanie CP ${shortNumber}`,
      detail: 'Najprv overte schránku. Bez dôkazu ponuku neposielajte znova.',
      createdAt: offer.sendStartedAt || offer.createdAt, href: `/admin/ponuky/${offer.id}`, urgency: 'critical',
    });
    if (offer.status === 'ODOSLANA' && effectiveOfferDate(offer) <= daysBefore(now, 5)) items.push({
      id: `offer-outcome-${offer.id}`, category: 'offer_outcome', title: `Zistiť výsledok CP ${shortNumber}`,
      detail: 'Ponuka čaká najmenej päť dní. Skontrolujte históriu komunikácie a zaevidujte výsledok. Systém dovolí najviac jednu odoslanú pripomienku.',
      createdAt: effectiveOfferDate(offer), href: `/admin/ponuky/${offer.id}`, urgency: 'attention',
    });
    if (offer.status === 'ODLOZENA' && offer.nextFollowUpAt && offer.nextFollowUpAt <= businessTodayKey(now)) items.push({
      id: `offer-deferred-${offer.id}`, category: 'offer_outcome', title: `Vrátiť sa k odloženej CP ${shortNumber}`,
      detail: 'Nastal uložený dátum ďalšieho kontaktu.',
      createdAt: offer.outcomeUpdatedAt || offer.createdAt, href: `/admin/ponuky/${offer.id}`, urgency: 'attention',
    });
  }
  if (reviewResult.status === 'rejected') unavailableSources.push('žiadosti o referencie');
  else for (const request of reviewResult.value) {
    const shortId = request.id.slice(0, 8);
    const base = { createdAt: request.updatedAt, href: '/admin/referencie' };
    if (request.status === 'pending_approval' || request.status === 'delivery_failed') items.push({
      ...base, id: `review-send-${request.id}`, category: 'review_send', title: `Skontrolovať žiadosť #${shortId}`,
      detail: request.status === 'delivery_failed' ? 'Preverte zlyhanie a až potom rozhodnite o opakovaní.' : 'Pred prvým odoslaním skontrolujte adresáta a text.',
      urgency: request.status === 'delivery_failed' ? 'attention' : 'normal',
    });
    if (request.status === 'delivery_unknown' || request.reminderStatus === 'delivery_unknown') items.push({
      ...base, id: `delivery-${request.id}`, category: 'delivery_resolution', title: `Vyriešiť neznámy výsledok #${shortId}`,
      detail: 'Overte schránku a poskytovateľa. Bez dôkazu správu neposielajte znova.', urgency: 'critical',
    });
    if (request.reminderAllowed && request.reminderDueAt && request.reminderDueAt <= nowIso && !request.reminderAttemptedAt && !request.reminderStatus && ['smtp_accepted', 'opened'].includes(request.status)) items.push({
      ...base, id: `reminder-${request.id}`, category: 'review_reminder', title: `Skontrolovať splatnú pripomienku #${shortId}`,
      detail: 'Ide o jedinú pripomienku, ktorú človek povolil pri príprave žiadosti.', createdAt: request.reminderDueAt, urgency: 'attention',
    });
    if (request.status === 'submitted') items.push({
      ...base, id: `moderate-${request.id}`, category: 'review_moderation', title: `Skontrolovať prijatú referenciu #${shortId}`,
      detail: 'Overte obsah a súhlas. Verejné publikovanie zostáva iba superadminovi.', urgency: 'attention',
    });
  }
  const urgencyRank = { critical: 0, attention: 1, normal: 2 } as const;
  items.sort((left, right) => urgencyRank[left.urgency] - urgencyRank[right.urgency] || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const counts = items.reduce<Record<AdminApprovalQueueItem['category'], number>>((totals, item) => {
    totals[item.category] += 1;
    return totals;
  }, { offer_approval: 0, offer_outcome: 0, review_send: 0, review_reminder: 0, review_moderation: 0, delivery_resolution: 0, photo_review: 0, case_draft: 0, case_approval: 0, case_publication: 0, realization_publication: 0 });
  return { generatedAt: nowIso, items, counts, unavailableSources };
}

export type AdminSearchResult = {
  query: string;
  leads: Array<{ id: string; fullName: string; phone: string; email: string; city: string; status: string }>;
  jobs: Array<{ id: string; customerName: string; location: string; demolitionDate: string; status: string; number?: string; responsibleEmail?: string; archived?: boolean }>;
  offers: Array<{ id: string; number: string; contactPerson: string; objectAddress: string; totalWithVat: number | null; source?: 'GENERATED' | 'MANUAL_PDF'; status?: string; jobId?: string | null; archived?: boolean }>;
  reviews: Array<{ id: string; customerName: string; customerEmail: string; phone: string; location: string; status: string }>;
  finance: Array<{ id: string; jobId: string; invoiceNumber: string; issuedOn: string; dueOn: string; amountWithVatCents: number }>;
  pagination?: { page: number; pageSize: number; totalPages: number; totals: { leads: number; jobs: number; offers: number; reviews: number; finance: number } };
};

export async function getAdminOperationsOverview(role: AdminRole, now = new Date()) {
  const today = businessTodayKey(now);
  const horizon = addDays(today, 14);
  const month = businessPeriodBounds('month', undefined, undefined, now);
  const financePromise = role === 'SUPER_ADMIN' ? listBusinessFinanceEvidence() : Promise.resolve(null);
  const jobsPromise = role === 'SUPER_ADMIN'
    ? listBusinessJobs({ limit: null, excludeTestData: true })
    : listOperationalBusinessJobs({ limit: null, excludeTestData: true });
  const workersPromise = role === 'SUPER_ADMIN' ? listWorkers(false) : listOperationalWorkers(false);
  const [leads, jobs, offers, eligibleReviewJobs, planner, workers, financeEvidence, leadMetrics, offerMetrics, reviewMetrics, funnelEvents] = await Promise.all([
    listLeads(),
    jobsPromise,
    listPriceOffers(),
    listEligibleReviewJobs(),
    listPlannerActions(),
    workersPromise,
    financePromise,
    getLeadDashboardMetrics(month.from, month.to, today),
    getPriceOfferEventMetrics(month.from, month.to),
    getReviewRequestEventMetrics(month.from, month.to),
    getOperationalFunnelEventMetrics(month.from, month.to),
  ]);

  const realLeads = leads.filter((lead) => !lead.isTestData && !lead.deletedAt);
  const realOffers = offers.filter((offer) => !offer.isTestData && !offer.deletedAt);
  const staleCutoff = daysBefore(now, 7);
  const silentCutoff = daysBefore(now, 5);
  const stalledJobs = jobs
    .filter((job) => activeJobStatuses.has(job.status) && job.updatedAt <= staleCutoff)
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  const silentOffers = realOffers
    .filter((offer) => offer.status === 'ODOSLANA' && effectiveOfferDate(offer) <= silentCutoff)
    .sort((left, right) => effectiveOfferDate(left).localeCompare(effectiveOfferDate(right)));
  const uncertainOffers = realOffers.filter((offer) => offer.status === 'NEISTY_STAV' || (offer.status === 'ODOSIELA' && offer.sendStartedAt && offer.sendStartedAt <= daysBefore(now, 1)));

  const referenceCandidates = eligibleReviewJobs;

  const plannerHorizon = planner.filter((action) => action.date >= today && action.date <= horizon);
  const completedDocumentJobIds = new Set(planner
    .filter((action) => action.type === 'DOKUMENTACIA' && action.status === 'DOKONCENA' && action.jobId)
    .map((action) => action.jobId));
  const financialJobs = jobs.filter(isFinancialBusinessJob);
  const positivePrices = financialJobs.map((job) => job.pricePerM2).filter((price) => price > 0).sort((a, b) => a - b);
  const medianPrice = positivePrices.length
    ? positivePrices.length % 2
      ? positivePrices[Math.floor(positivePrices.length / 2)]
      : (positivePrices[positivePrices.length / 2 - 1] + positivePrices[positivePrices.length / 2]) / 2
    : 0;
  const unusualPriceJobs = role === 'SUPER_ADMIN'
    ? financialJobs.filter((job) => job.status !== 'ZRUSENA' && (job.pricePerM2 <= 0
      || (positivePrices.length >= 5 && (job.pricePerM2 < medianPrice * 0.5 || job.pricePerM2 > medianPrice * 2))))
    : [];
  const qualityIssues = {
    leadsWithoutOwner: realLeads.filter((lead) => !lead.ownerEmail && !['dokoncena', 'zrusena', 'nevyslo', 'archivovane'].includes(lead.status)),
    leadsWithoutNextStep: realLeads.filter((lead) => !lead.nextAction && ['kontaktovany', 'caka_na_doplnenie', 'naceneny', 'cenova_ponuka_odoslana'].includes(lead.status)),
    jobsWithoutContact: jobs.filter((job) => !job.customerPhone && !job.customerEmail && job.status !== 'ZRUSENA'),
    jobsWithoutWorkers: jobs.filter((job) => ['DEMONT_NAPLANOVANA', 'V_REALIZACII'].includes(job.status) && job.workers.length === 0),
    jobsWithoutDocuments: jobs.filter((job) => completedJobStatuses.has(job.status) && !completedDocumentJobIds.has(job.id)),
    jobsWithoutCosts: role === 'SUPER_ADMIN' ? financialJobs.filter((job) => job.status !== 'ZRUSENA' && job.totalPrice > 0 && job.costs.total === 0 && job.rewardsTotal === 0) : [],
    unusualPriceJobs,
    uncertainOffers,
    plannerWithoutTime: plannerHorizon.filter((action) => action.status !== 'DOKONCENA' && action.status !== 'ZRUSENA' && !action.timeFrom),
  };

  const openPlanner = plannerHorizon.filter((action) => action.status !== 'DOKONCENA' && action.status !== 'ZRUSENA');
  const collisions: Array<{ first: PlannerAction; second: PlannerAction; reason: string }> = [];
  for (let leftIndex = 0; leftIndex < openPlanner.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < openPlanner.length; rightIndex += 1) {
      const left = openPlanner[leftIndex];
      const right = openPlanner[rightIndex];
      if (left.date !== right.date || !actionsOverlap(left, right)) continue;
      if (left.jobId && right.jobId && left.jobId === right.jobId) collisions.push({ first: left, second: right, reason: 'rovnaká zákazka má prekrývajúce sa akcie' });
      else if (hasSharedWorker(left, right)) collisions.push({ first: left, second: right, reason: 'rovnaký pracovník je plánovaný súčasne' });
    }
  }
  const workload = workers.map((worker) => {
    const workerName = worker.name.toLocaleLowerCase('sk');
    return { id: worker.id, name: worker.name, actions: openPlanner.filter((action) => splitWorkers(action.workers).includes(workerName)).length };
  }).sort((left, right) => right.actions - left.actions || left.name.localeCompare(right.name, 'sk'));

  const rewardOverview = role === 'SUPER_ADMIN'
    ? workers.map((worker) => ({
        id: worker.id,
        name: worker.name,
        amount: financialJobs
          .filter((job) => job.demolitionDate >= month.from && job.demolitionDate <= month.to)
          .flatMap((job) => job.workers)
          .filter((jobWorker) => jobWorker.workerId === worker.id)
          .reduce((sum, jobWorker) => sum + jobWorker.reward, 0),
      })).filter((worker) => worker.amount > 0).sort((a, b) => b.amount - a.amount)
    : null;

  let overdueInvoices: Array<{ job: BusinessJob; invoiceNumber: string; dueOn: string; outstandingCents: number }> = [];
  let paidJobs: number | undefined;
  let netReceivedCents: number | undefined;
  let lastPaymentAt: string | undefined;
  if (financeEvidence) {
    const jobsById = new Map(financialJobs.map((job) => [job.id, job]));
    const financeJobIds = new Set([...financeEvidence.invoices.map((item) => item.jobId), ...financeEvidence.paymentEvents.map((item) => item.jobId)]);
    for (const jobId of financeJobIds) {
      const job = jobsById.get(jobId);
      if (!job) continue;
      const jobInvoices = financeEvidence.invoices.filter((item) => item.jobId === jobId);
      const projection = projectBusinessJobFinance(jobInvoices, financeEvidence.paymentEvents.filter((item) => item.jobId === jobId), today);
      const invoicesById = new Map(jobInvoices.map((invoice) => [invoice.id, invoice]));
      for (const balance of projection.invoiceBalances) {
        if (!balance.overdue || !balance.outstandingCents) continue;
        const invoice = invoicesById.get(balance.invoiceId);
        if (invoice) overdueInvoices.push({ job, invoiceNumber: invoice.invoiceNumber, dueOn: invoice.dueOn || '', outstandingCents: balance.outstandingCents });
      }
    }
    overdueInvoices = overdueInvoices.sort((left, right) => left.dueOn.localeCompare(right.dueOn));
    const reversedReceiptIds = new Set(financeEvidence.paymentEvents.filter((event) => event.eventType === 'REVERSAL' && event.reversalOf).map((event) => event.reversalOf));
    const effectiveReceipts = financeEvidence.paymentEvents.filter((event) => event.eventType === 'RECEIPT'
      && event.occurredOn >= month.from && event.occurredOn <= month.to && !reversedReceiptIds.has(event.id));
    paidJobs = new Set(effectiveReceipts.map((event) => event.jobId)).size;
    netReceivedCents = effectiveReceipts.reduce((sum, event) => sum + event.amountCents, 0);
    lastPaymentAt = effectiveReceipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt;
  }

  const monthLeads = realLeads.filter((lead) => {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(lead.createdAt));
    return key >= month.from && key <= month.to;
  });
  const monthSentOffers = realOffers.filter((offer) => offer.sentAt && offer.sentAt >= `${month.from}T00:00:00` && offer.sentAt <= `${month.to}T23:59:59`);
  const monthAcceptedOffers = realOffers.filter((offer) => offer.acceptedAt && offer.acceptedAt >= `${month.from}T00:00:00` && offer.acceptedAt <= `${month.to}T23:59:59`);

  return {
    generatedAt: now.toISOString(),
    today,
    stalledJobs,
    silentOffers,
    referenceCandidates,
    overdueInvoices,
    qualityIssues,
    capacity: {
      from: today,
      to: horizon,
      openActions: openPlanner,
      unassignedActions: openPlanner.filter((action) => !action.workers.trim()),
      collisions,
      workload,
      freeWorkdays: freeWorkdays(today, horizon, plannerHorizon),
      ...(rewardOverview ? { rewardOverview } : {}),
    },
    performance: {
      leads: leadMetrics.receivedInPeriod,
      newToday: leadMetrics.newToday,
      contactedLeads: funnelEvents.contactedLeads,
      offersCreated: offerMetrics.created,
      offersSent: offerMetrics.sent,
      offersAccepted: offerMetrics.accepted,
      completedJobs: funnelEvents.completedJobs,
      reviewRequests: reviewMetrics.created,
      reviewsReceived: reviewMetrics.submitted,
      ...(paidJobs !== undefined && netReceivedCents !== undefined ? { paidJobs, netReceivedCents } : {}),
    },
    automationEvents: {
      leadReceived: monthLeads.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt,
      leadContacted: funnelEvents.lastContactedAt,
      offerSent: monthSentOffers.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))[0]?.sentAt,
      offerAccepted: monthAcceptedOffers.sort((a, b) => String(b.acceptedAt).localeCompare(String(a.acceptedAt)))[0]?.acceptedAt,
      jobCompleted: funnelEvents.lastCompletedAt,
      ...(lastPaymentAt ? { paymentReceived: lastPaymentAt } : {}),
    },
  };
}

export async function searchAdminRecords(query: string, role: AdminRole, options: import('./job-workspace-types').JobWorkspaceSearchOptions = {}): Promise<AdminSearchResult> {
  if (role !== 'SUPER_ADMIN' && role !== 'OPERATOR') throw new Error('Vyhľadávanie firemných záznamov nie je pre túto rolu dostupné.');
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return { query: q, leads: [], jobs: [], offers: [], reviews: [], finance: [] };
  return { query: q, ...await searchAdminData(q, role === 'SUPER_ADMIN', options) };
}
