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
      offersCreated: number;
      offersSent: number;
      offersAccepted: number;
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
