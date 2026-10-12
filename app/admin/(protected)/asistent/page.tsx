import { requireAdminUser } from '@/src/server/auth';
import { getBusinessAssistantBriefing } from '@/src/server/business-assistant';
import { statusLabels } from '@/src/server/lead-insights';
import type { LeadStatus, PlannerAction } from '@/src/server/types';

function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
function euroCents(value: number) {
  return euro(value / 100);
}

function dateSk(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'long', timeZone: 'Europe/Bratislava' }).format(new Date(`${value}T12:00:00Z`));
}

type LeadPreview = Awaited<ReturnType<typeof getBusinessAssistantBriefing>>['leads']['new'][number];

function LeadQueue({ title, note, leads, empty, href }: { title: string; note: string; leads: LeadPreview[]; empty: string; href: string }) {
  return (
    <article className="assistant-queue-column">
      <div className="assistant-queue-heading">
        <div><h3>{title}</h3><p>{note}</p></div>
        <strong>{leads.length}</strong>
      </div>
      {leads.length ? (
        <ul className="assistant-lead-list">
          {leads.slice(0, 5).map((lead) => (
            <li key={lead.id}>
              <a href={`/admin/dopyty/${lead.id}`}>
                <span><strong>{lead.fullName}</strong><small>{lead.city || 'Lokalita neuvedená'} · {lead.areaEstimate > 0 ? `${lead.areaEstimate} m²` : 'výmera neuvedená'}</small></span>
                <em>{statusLabels[lead.status as LeadStatus] || lead.status}</em>
              </a>
              <small>{lead.nextAction || (lead.fileCount ? `${lead.fileCount} fotiek v dopyte` : 'Bez priloženej fotografie')}</small>
            </li>
          ))}
        </ul>
      ) : <p className="assistant-empty">{empty}</p>}
      <a className="assistant-text-link" href={href}>Zobraziť celú frontu →</a>
    </article>
  );
}
function PlannerList({ title, date, actions }: { title: string; date: string; actions: PlannerAction[] }) {
  return (
    <article className="assistant-plan-day">
      <div><p>{title}</p><h3>{dateSk(date)}</h3></div>
      {actions.length ? (
        <ol>
          {actions.map((action) => (
            <li key={action.id}>
              <time>{action.timeFrom || 'Čas neurčený'}{action.timeTo ? ` – ${action.timeTo}` : ''}</time>
              <span><strong>{action.customerName || action.address || 'Interná úloha'}</strong><small>{action.address}{action.workers ? ` · ${action.workers}` : ''}</small></span>
            </li>
          ))}
        </ol>
      ) : <p className="assistant-empty">Nie je naplánovaná žiadna otvorená akcia.</p>}
    </article>
  );
}

export default async function BusinessAssistantPage() {
  const adminUser = await requireAdminUser();
  const briefing = await getBusinessAssistantBriefing(adminUser.role);
  const urgentCount = briefing.priorities.filter((item) => item.tone === 'critical').length;
  const mailAttention = briefing.mail.overduePending + briefing.mail.staleSending + briefing.mail.failed + briefing.mail.unknown;
  const generated = new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(briefing.generatedAt));

  return (
    <main className="admin-page assistant-page">
      <div className="admin-heading assistant-hero">
        <div>
          <p>Pracovný asistent · {adminUser.role === 'SUPER_ADMIN' ? 'majiteľský pohľad' : 'operátorský pohľad'}</p>
          <h1>Čo treba vyriešiť dnes</h1>
          <span>Aktualizované {generated}. Údaje sa iba čítajú; asistent nič neposiela ani nemení.</span>
        </div>
        <a className="admin-primary-link" href="/admin/dopyty">Otvoriť dopyty</a>
      </div>

      <section className="admin-stat-grid assistant-stat-grid" aria-label="Súhrn práce na dnes">
        <article><span>Kritické upozornenia</span><strong>{urgentCount}</strong><small>{urgentCount ? 'Riešte ako prvé' : 'Bez kritického upozornenia'}</small></article>
        <article><span>Follow-up na vybavenie</span><strong>{briefing.queues.followups}</strong><a href="/admin/dopyty?queue=followup">Otvoriť frontu</a></article>
        <article><span>Nové dopyty</span><strong>{briefing.queues.newLeads}</strong><a href="/admin/dopyty?queue=new">Kontaktovať</a></article>
        <article><span>Emaily na kontrolu</span><strong>{mailAttention}</strong><small>{briefing.mail.unknown ? `${briefing.mail.unknown} s neznámym výsledkom` : 'Bez neznámeho výsledku'}</small></article>
      </section>

      <section className="admin-card assistant-priorities" aria-labelledby="assistant-priorities-title">
        <div className="admin-section-heading">
          <div><p>Zoradené podľa rizika a času</p><h2 id="assistant-priorities-title">Odporúčané poradie práce</h2></div>
          <span>{briefing.priorities.length} odporúčaní</span>
        </div>
        <div className="assistant-priority-list">
          {briefing.priorities.map((item, index) => (
            <article className={`assistant-priority is-${item.tone}`} key={item.id}>
              <span className="assistant-priority-order">{index + 1}</span>
              <div className="assistant-priority-copy">
                <p>{item.eyebrow}</p>
                <h3>{item.title}</h3>
                <span>{item.detail}</span>
              </div>
              <strong className="assistant-priority-metric">{item.metric}</strong>
              <a href={item.href}>{item.actionLabel} →</a>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-card" aria-labelledby="assistant-leads-title">
        <div className="admin-section-heading">
          <div><p>Najnovšie položky bez testovacích dát</p><h2 id="assistant-leads-title">Dopyty na rade</h2></div>
          <a href="/admin/dopyty">Všetky dopyty</a>
        </div>
        <div className="assistant-queue-grid">
          <LeadQueue title="Nové" note="Bez prvého kontaktu" leads={briefing.leads.new} empty="Žiadny nový dopyt." href="/admin/dopyty?queue=new" />
          <LeadQueue title="Follow-up" note="Dnes alebo po termíne" leads={briefing.leads.followups} empty="Žiadny splatný follow-up." href="/admin/dopyty?queue=followup" />
          <LeadQueue title="Na nacenenie" note="Ponuku schvaľuje človek" leads={briefing.leads.quote} empty="Žiadny dopyt v tejto fronte." href="/admin/dopyty?queue=quote" />
        </div>
      </section>

      <section className="admin-card" aria-labelledby="assistant-planner-title">
        <div className="admin-section-heading">
          <div><p>Najbližšie otvorené akcie</p><h2 id="assistant-planner-title">Plán práce</h2></div>
          <a href="/admin/planovac">Celý plánovač</a>
        </div>
        <div className="assistant-planner-grid">
          <PlannerList title="Dnes" date={briefing.today} actions={briefing.planner.today} />
          <PlannerList title="Zajtra" date={briefing.tomorrow} actions={briefing.planner.tomorrow} />
        </div>
      </section>

      {adminUser.role === 'SUPER_ADMIN' && briefing.superadmin ? (
        <>
          <section className="admin-card" aria-labelledby="assistant-owner-title">
            <div className="admin-section-heading">
              <div><p>Iba pre superadmina</p><h2 id="assistant-owner-title">Majiteľský prehľad</h2></div>
              <a href="/admin/dashboard">Podrobný dashboard</a>
            </div>
            <p className="admin-muted-note">Financie nižšie vychádzajú zo skutočne zaevidovaných dokladov. Evidované ceny zákaziek sú samostatný operatívny údaj.</p>
            <div className="assistant-owner-grid">
              <article><span>Aktuálne po splatnosti</span><strong>{euroCents(briefing.superadmin.finance.currentOverdueCents)}</strong><small>Podľa faktúr a úhrad</small></article>
              <article><span>Aktuálne neuhradené</span><strong>{euroCents(briefing.superadmin.finance.currentOutstandingCents)}</strong><small>{briefing.superadmin.finance.jobsWithEvidence} zákaziek s finančným dokladom</small></article>
              <article><span>Nepriradené úhrady</span><strong>{euroCents(briefing.superadmin.finance.currentUnallocatedCents)}</strong><small>Vyžadujú kontrolu priradenia</small></article>
              <article><span>Zákazky bez nákladov</span><strong>{briefing.superadmin.jobsWithoutRecordedDirectCosts}</strong><small>Aktuálny mesiac</small></article>
              <article><span>Evidované ceny zákaziek</span><strong>{euro(briefing.superadmin.business.recordedOrderValue)}</strong><small>Nie je to prijatá platba</small></article>
              <article><span>Zadané náklady a odmeny</span><strong>{euro(briefing.superadmin.business.recordedDirectCosts)}</strong><small>{briefing.superadmin.business.activeJobs} aktívnych záznamov</small></article>
            </div>
          </section>

          <section className="admin-card assistant-owner-details" aria-labelledby="assistant-system-title">
            <div>
              <p>Kontrola prevádzky</p>
              <h2 id="assistant-system-title">Systém</h2>
              <ul>
                <li className={briefing.superadmin.health.database.ok ? 'is-ok' : 'is-error'}><strong>Databáza</strong><span>{briefing.superadmin.health.database.detail}</span></li>
                <li className={briefing.superadmin.health.storage.ok ? 'is-ok' : 'is-warning'}><strong>Úložisko</strong><span>{briefing.superadmin.health.storage.detail}</span></li>
                <li className={`is-${briefing.superadmin.health.leadMail.level}`}><strong>Dopytové emaily</strong><span>{briefing.superadmin.health.leadMail.detail}</span></li>
              </ul>
              <a className="assistant-text-link" href="/admin/health">Otvoriť úplnú kontrolu systému →</a>
            </div>
            <div>
              <p>Aktuálny mesiac</p>
              <h2>Obchodný tok</h2>
              <ol className="assistant-funnel">
                <li><span>Dopyty</span><strong>{briefing.superadmin.funnel.leadsReceived}</strong></li>
                <li><span>Vytvorené ponuky</span><strong>{briefing.superadmin.funnel.offersCreated}</strong></li>
                <li><span>Odoslané ponuky</span><strong>{briefing.superadmin.funnel.offersSent}</strong></li>
                <li><span>Prijaté ponuky</span><strong>{briefing.superadmin.funnel.offersAccepted}</strong></li>
              </ol>
            </div>
          </section>
        </>
      ) : null}

      <section className="admin-card assistant-guardrail" aria-labelledby="assistant-guardrail-title">
        <div><span aria-hidden="true">✓</span></div>
        <div>
          <p>Bezpečnostná poistka</p>
          <h2 id="assistant-guardrail-title">Rozhodnutie a odoslanie zostáva na človeku</h2>
          <span>Asistent iba odporúča poradie práce. Cenové ponuky, emaily, zmeny platieb, reklamy, publikovanie fotografií a mazanie sa bez výslovného schválenia nevykonajú.</span>
        </div>
      </section>
    </main>
  );
}
