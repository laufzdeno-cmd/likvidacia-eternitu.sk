import type { AdminRole } from '@/src/server/types';

export type BusinessAssistantTone = 'critical' | 'warning' | 'action' | 'opportunity' | 'stable';

export type BusinessAssistantPriority = {
  id: string;
  rank: number;
  tone: BusinessAssistantTone;
  eyebrow: string;
  title: string;
  detail: string;
  metric: string;
  href: string;
  actionLabel: string;
  timing?: 'overdue' | 'today' | 'upcoming';
};

export type BusinessAssistantInput = {
  role: AdminRole;
  queues: {
    total: number;
    newLeads: number;
    unassigned: number;
    followups: number;
    waiting: number;
    quote: number;
    active: number;
  };
  mail: {
    overduePending: number;
    staleSending: number;
    failed: number;
    unknown: number;
    oldestAttentionLeadId: string | null;
  };
  planner: {
    todayOpen: number;
    tomorrowOpen: number;
  };
  operations?: {
    stalledJobs: number;
    silentOffers: number;
    referenceCandidates: number;
    overdueInvoices: number;
    overdueInvoicesCents: number;
    capacityCollisions: number;
    dataQualityIssues: number;
  };
  superadmin?: {
    finance: {
      currentOverdueCents: number;
      currentOutstandingCents: number;
      currentUnallocatedCents: number;
      jobsWithEvidence: number;
    };
    jobsWithoutRecordedDirectCosts: number;
    health: {
      databaseOk: boolean;
      storageOk: boolean;
      leadMailLevel: 'ok' | 'warning' | 'error';
    };
    funnel: {
      leadsReceived: number;
      contactedLeads: number;
      offersCreated: number;
      offersSent: number;
      offersAccepted: number;
      completedJobs: number;
      paidJobs: number;
      reviewsReceived: number;
    };
  };
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
function cents(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value / 100);
}

export function buildBusinessAssistantPriorities(input: BusinessAssistantInput): BusinessAssistantPriority[] {
  const priorities: BusinessAssistantPriority[] = [];
  const mailAttention = input.mail.overduePending + input.mail.staleSending + input.mail.failed + input.mail.unknown;

  if (input.operations?.stalledJobs) priorities.push({
    id: 'stalled-jobs', rank: 8, tone: 'critical', eyebrow: 'Zaseknuté zákazky',
    title: 'Posuňte zákazky bez aktivity',
    detail: 'Otvorené zákazky sa viac ako 7 dní nezmenili. Skontrolujte ďalší krok, termín a zodpovednosť.',
    metric: String(input.operations.stalledJobs), href: '/admin/kontrola-dat#zaseknute-zakazky', actionLabel: 'Skontrolovať zákazky', timing: 'overdue',
  });

  if (input.operations?.silentOffers) priorities.push({
    id: 'silent-offers', rank: 11, tone: 'warning', eyebrow: 'Ponuky bez reakcie',
    title: 'Urobte follow-up po odoslanej ponuke',
    detail: 'Ponuky sú odoslané najmenej 5 dní bez prijatia alebo zrušenia. Kontakt zostáva manuálny.',
    metric: String(input.operations.silentOffers), href: '/admin/kontrola-dat#ponuky-bez-reakcie', actionLabel: 'Otvoriť zoznam', timing: 'overdue',
  });

  if (mailAttention > 0) {
    const unknownWarning = input.mail.unknown > 0
      ? ` ${countLabel(input.mail.unknown, 'email má', 'emailov má')} neznámy výsledok; bez overenia ich neposielajte znova.`
      : '';
    priorities.push({
      id: 'mail-attention',
      rank: 0,
      tone: 'critical',
      eyebrow: 'Doručenie dopytov',
      title: 'Skontrolujte problémové emaily',
      detail: `${countLabel(mailAttention, 'email vyžaduje', 'emailov vyžaduje')} manuálnu kontrolu.${unknownWarning}`,
      metric: String(mailAttention),
      href: input.mail.oldestAttentionLeadId ? `/admin/dopyty/${input.mail.oldestAttentionLeadId}` : '/admin/dopyty',
      actionLabel: 'Otvoriť najstarší problém',
      timing: 'overdue',
    });
  }

  if (input.queues.followups > 0) priorities.push({
    id: 'followups',
    rank: 10,
    tone: 'critical',
    eyebrow: 'Kontakt so zákazníkom',
    title: 'Vybavte dnešné a omeškané follow-upy',
    detail: 'Ide o dopyty s termínom kontaktovania dnes alebo v minulosti.',
    metric: String(input.queues.followups),
    href: '/admin/dopyty?queue=followup',
    actionLabel: 'Otvoriť follow-upy',
    timing: 'overdue',
  });

  if (input.queues.newLeads > 0) priorities.push({
    id: 'new-leads',
    rank: 20,
    tone: 'action',
    eyebrow: 'Nový obchod',
    title: 'Kontaktujte nové dopyty',
    detail: 'Tieto dopyty ešte nemajú zaznamenaný prvý kontakt.',
    metric: String(input.queues.newLeads),
    href: '/admin/dopyty?queue=new',
    actionLabel: 'Otvoriť nové dopyty',
  });

  if (input.queues.unassigned > 0) priorities.push({
    id: 'unassigned',
    rank: 25,
    tone: 'warning',
    eyebrow: 'Zodpovednosť',
    title: 'Priraďte vlastníka dopytu',
    detail: 'Bez vlastníka nie je jasné, kto má ďalší krok vybaviť.',
    metric: String(input.queues.unassigned),
    href: '/admin/dopyty?queue=unassigned',
    actionLabel: 'Priradiť dopyty',
  });

  if (input.queues.quote > 0) priorities.push({
    id: 'quotes',
    rank: 30,
    tone: 'opportunity',
    eyebrow: 'Cenové ponuky',
    title: 'Pripravte podklady na nacenenie',
    detail: 'Dopyty sú označené ako nacenené; ponuku vždy skontroluje a odošle človek.',
    metric: String(input.queues.quote),
    href: '/admin/dopyty?queue=quote',
    actionLabel: 'Otvoriť nacenenie',
  });

  if (input.planner.todayOpen > 0 || input.planner.tomorrowOpen > 0) priorities.push({
    id: 'planner',
    rank: 40,
    tone: input.planner.todayOpen > 0 ? 'action' : 'stable',
    eyebrow: 'Plánovač',
    title: input.planner.todayOpen > 0 ? 'Skontrolujte dnešný plán' : 'Pripravte sa na zajtrajšie akcie',
    detail: `Dnes zostáva ${input.planner.todayOpen} otvorených akcií, zajtra ${input.planner.tomorrowOpen}.`,
    metric: String(input.planner.todayOpen || input.planner.tomorrowOpen),
    href: '/admin/planovac',
    actionLabel: 'Otvoriť plánovač',
    timing: input.planner.todayOpen > 0 ? 'today' : 'upcoming',
  });

  if (input.queues.waiting > 0) priorities.push({
    id: 'waiting',
    rank: 50,
    tone: 'warning',
    eyebrow: 'Chýbajúce informácie',
    title: 'Doplňte neúplné dopyty',
    detail: 'Zákazník alebo interný tím ešte musí doplniť údaje potrebné na ďalší krok.',
    metric: String(input.queues.waiting),
    href: '/admin/dopyty?queue=waiting',
    actionLabel: 'Otvoriť čakajúce dopyty',
  });

  if (input.role === 'SUPER_ADMIN' && input.superadmin) {
    const { finance, health, jobsWithoutRecordedDirectCosts, funnel } = input.superadmin;
    const systemProblem = !health.databaseOk || !health.storageOk || health.leadMailLevel !== 'ok';
    if (systemProblem) priorities.push({
      id: 'system-health',
      rank: health.databaseOk ? 12 : 1,
      tone: health.databaseOk ? 'warning' : 'critical',
      eyebrow: 'Technický stav',
      title: health.databaseOk ? 'Skontrolujte prevádzkové upozornenia' : 'Databáza neprešla kontrolou',
      detail: `Databáza: ${health.databaseOk ? 'v poriadku' : 'problém'} · úložisko: ${health.storageOk ? 'nastavené' : 'nenastavené'} · emaily: ${health.leadMailLevel}.`,
      metric: '!',
      href: '/admin/health',
      actionLabel: 'Otvoriť kontrolu systému',
    });

    if (finance.currentOverdueCents > 0) priorities.push({
      id: 'overdue-finance',
      rank: 15,
      tone: 'critical',
      eyebrow: 'Skutočné doklady',
      title: 'Skontrolujte sumy po splatnosti',
      detail: 'Suma vychádza iba zo zaevidovaných faktúr a úhrad, nie z odhadov zákaziek.',
      metric: cents(finance.currentOverdueCents),
      href: '/admin/zakazky',
      actionLabel: 'Otvoriť zákazky',
      timing: 'overdue',
    });

    if (finance.currentUnallocatedCents > 0) priorities.push({
      id: 'unallocated-finance',
      rank: 28,
      tone: 'warning',
      eyebrow: 'Platby',
      title: 'Priraďte prijaté úhrady',
      detail: 'Evidovaná úhrada zatiaľ nie je úplne priradená ku konkrétnej faktúre.',
      metric: cents(finance.currentUnallocatedCents),
      href: '/admin/zakazky',
      actionLabel: 'Skontrolovať financie',
    });

    if (jobsWithoutRecordedDirectCosts > 0) priorities.push({
      id: 'missing-costs',
      rank: 45,
      tone: 'warning',
      eyebrow: 'Kvalita dát',
      title: 'Doplňte priame náklady',
      detail: 'Aktívne zákazky v tomto mesiaci majú nulové priame náklady aj odmeny; ziskovosť by bola zavádzajúca.',
      metric: String(jobsWithoutRecordedDirectCosts),
      href: '/admin/zakazky',
      actionLabel: 'Otvoriť zákazky',
    });

    if (funnel.leadsReceived > 0 && funnel.offersCreated === 0) priorities.push({
      id: 'funnel-gap',
      rank: 48,
      tone: 'opportunity',
      eyebrow: 'Obchodný lievik',
      title: 'Dopyty sa ešte nepremenili na ponuky',
      detail: `Tento mesiac prišlo ${funnel.leadsReceived} dopytov, ale nie je zaevidovaná žiadna vytvorená ponuka.`,
      metric: String(funnel.leadsReceived),
      href: '/admin/dopyty',
      actionLabel: 'Skontrolovať dopyty',
    });
  }

  if (input.operations?.capacityCollisions) priorities.push({
    id: 'capacity-collisions', rank: 18, tone: 'critical', eyebrow: 'Kapacita tímu',
    title: 'Vyriešte kolízie v plánovači',
    detail: 'Rovnaká zákazka alebo pracovník je evidovaný v prekrývajúcich sa časoch.',
    metric: String(input.operations.capacityCollisions), href: '/admin/kontrola-dat#kapacita', actionLabel: 'Skontrolovať kapacitu', timing: 'today',
  });

  if (input.operations?.dataQualityIssues) priorities.push({
    id: 'data-quality', rank: 44, tone: 'warning', eyebrow: 'Kvalita dát',
    title: 'Doplňte chýbajúce údaje',
    detail: 'Chýbajúci vlastník, ďalší krok, kontakt, pracovníci alebo náklady znižujú spoľahlivosť prehľadov.',
    metric: String(input.operations.dataQualityIssues), href: '/admin/kontrola-dat#kvalita-dat', actionLabel: 'Otvoriť kontrolu dát', timing: 'upcoming',
  });

  if (input.operations?.referenceCandidates) priorities.push({
    id: 'reference-candidates', rank: 60, tone: 'opportunity', eyebrow: 'Referencie',
    title: 'Vyberte dokončené zákazky na referenciu',
    detail: 'Dokončené zákazky ešte nemajú evidovanú žiadosť. Výber a odoslanie zostáva na človeku.',
    metric: String(input.operations.referenceCandidates), href: '/admin/referencie', actionLabel: 'Otvoriť žiadosti', timing: 'upcoming',
  });

  if (priorities.length === 0) priorities.push({
    id: 'all-clear',
    rank: 100,
    tone: 'stable',
    eyebrow: 'Práca na dnes',
    title: 'Žiadna kritická úloha nie je otvorená',
    detail: 'Aktuálne fronty, plánovač a doručovanie emailov nevyžadujú zásah.',
    metric: '✓',
    href: '/admin/dopyty',
    actionLabel: 'Otvoriť všetky dopyty',
  });

  return priorities.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}
