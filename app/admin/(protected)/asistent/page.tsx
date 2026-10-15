import { randomUUID } from 'node:crypto';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { getBusinessAssistantBriefing } from '@/src/server/business-assistant';
import { getAdminApprovalQueue, getAdminOperationalApprovalQueue, type AdminApprovalQueueItem } from '@/src/server/admin-intelligence';
import { countAdminWorkItems, getAdminWorkItemSuggestion, listAdminTaskAssignees, listAdminWorkItems } from '@/src/server/db';
import { buildAdminWorkQueue, normalizeAdminWorkQueueFilters, type AdminWorkQueueItem } from '@/src/lib/admin-work-queue';
import { statusLabels } from '@/src/server/lead-insights';
import type { AdminTaskAssignee, AdminWorkItem, LeadStatus, PlannerAction } from '@/src/server/types';
import { createAdminWorkItemAction, dismissAdminWorkItemSuggestionAction, transitionAdminWorkItemAction, updateAdminWorkItemAction } from './actions';

function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
function euroCents(value: number) { return euro(value / 100); }
function dateSk(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'long', timeZone: 'Europe/Bratislava' }).format(new Date(`${value}T12:00:00Z`));
}
function shortDate(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(`${value}T12:00:00Z`));
}

type LeadPreview = Awaited<ReturnType<typeof getBusinessAssistantBriefing>>['leads']['new'][number];

const priorityLabels = { CRITICAL: 'Kritická', HIGH: 'Vysoká', NORMAL: 'Bežná', LOW: 'Nízka' } as const;
const groupLabels = {
  OVERDUE: ['Po termíne', 'Vyžaduje pozornosť ako prvé'],
  TODAY: ['Dnes', 'Práca, ktorú treba posunúť dnes'],
  UPCOMING: ['Nasleduje', 'Pripravte si ďalšie kroky'],
  DONE: ['Hotové', 'Dokončené manuálne úlohy'],
  CANCELLED: ['Zrušené', 'Zachovaná história bez trvalého mazania'],
} as const;

const approvalLabels: Record<AdminApprovalQueueItem['category'], string> = {
  offer_approval: 'CP na kontrolu',
  offer_outcome: 'Výsledok CP',
  review_send: 'Žiadosť o referenciu',
  review_reminder: 'Pripomienka',
  review_moderation: 'Prijatá referencia',
  delivery_resolution: 'Neznáme doručenie',
  photo_review: 'Fotografia',
  case_draft: 'Koncept realizácie',
  case_approval: 'Schválenie prípadu',
  case_publication: 'Publikovanie prípadu',
  realization_publication: 'Publikovanie realizácie',
};

const noticeMessages: Record<string, [string, 'success' | 'warning' | 'error']> = {
  created: ['Úloha bola vytvorená.', 'success'], updated: ['Úloha bola uložená.', 'success'],
  completed: ['Úloha je dokončená.', 'success'], reopened: ['Úloha je znovu otvorená.', 'success'],
  cancelled: ['Úloha bola zrušená a zostala v histórii.', 'warning'],
  stale: ['Úlohu medzičasom upravil niekto iný. Skontrolujte jej aktuálny stav.', 'warning'],
  owner: ['Vybraný vlastník už nie je aktívny. Zvoľte iného používateľa.', 'warning'],
  missing: ['Úloha sa nenašla alebo k nej nemáte prístup.', 'error'],
  forbidden: ['Na túto zmenu nemáte oprávnenie.', 'error'],
  invalid: ['Údaje sa nepodarilo uložiť. Skontrolujte povinné polia.', 'error'],
  'suggestion-dismissed': ['Návrh asistenta bol odmietnutý. Úloha zostáva nepriradená, kým ju ručne neuložíte.', 'warning'],
};

function LeadQueue({ title, note, leads, empty, href }: { title: string; note: string; leads: LeadPreview[]; empty: string; href: string }) {
  return (
    <article className="assistant-queue-column">
      <div className="assistant-queue-heading"><div><h3>{title}</h3><p>{note}</p></div><strong>{leads.length}</strong></div>
      {leads.length ? <ul className="assistant-lead-list">{leads.slice(0, 4).map((lead) => (
        <li key={lead.id}>
          <a href={`/admin/dopyty/${lead.id}`}><span><strong>{lead.fullName}</strong><small>{lead.city || 'Lokalita neuvedená'} · {lead.areaEstimate > 0 ? `${lead.areaEstimate} m²` : 'výmera neuvedená'}</small></span><em>{statusLabels[lead.status as LeadStatus] || lead.status}</em></a>
          <small>{lead.nextAction || (lead.fileCount ? `${lead.fileCount} fotiek v dopyte` : 'Bez priloženej fotografie')}</small>
        </li>
      ))}</ul> : <p className="assistant-empty">{empty}</p>}
      <a className="assistant-text-link" href={href}>Zobraziť celú frontu →</a>
    </article>
  );
}

function PlannerList({ title, date, actions }: { title: string; date: string; actions: PlannerAction[] }) {
  return (
    <article className="assistant-plan-day">
      <div><p>{title}</p><h3>{dateSk(date)}</h3></div>
      {actions.length ? <ol>{actions.slice(0, 5).map((action) => (
        <li key={action.id}><time>{action.timeFrom || 'Čas neurčený'}{action.timeTo ? ` – ${action.timeTo}` : ''}</time><span><strong>{action.customerName || action.address || 'Interná úloha'}</strong><small>{action.address}{action.workers ? ` · ${action.workers}` : ''}</small></span></li>
      ))}</ol> : <p className="assistant-empty">Nie je naplánovaná žiadna otvorená akcia.</p>}
    </article>
  );
}

function ApprovalInbox({ items, unavailableSources, isSuperadmin }: {
  items: AdminApprovalQueueItem[]; unavailableSources: string[]; isSuperadmin: boolean;
}) {
  return <section className="work-approval-inbox" aria-labelledby="work-approval-title">
    <header><div><p>Rozhodnutia, ktoré systém neurobí za vás</p><h2 id="work-approval-title">Čaká na kontrolu</h2><span>{isSuperadmin ? 'Operatívne aj citlivé majiteľské schválenia na jednom mieste.' : 'Iba kroky, ktoré môže bezpečne spracovať operátor. Publikovanie a citlivé rozhodnutia ostávajú superadminovi.'}</span></div><strong>{items.length}</strong></header>
    {unavailableSources.length ? <p className="work-notice is-warning" role="status">Fronta nie je úplná. Nepodarilo sa načítať: {unavailableSources.join(', ')}.</p> : null}
    {items.length ? <ol>{items.slice(0, 8).map((item) => <li className={`is-${item.urgency}`} key={item.id}><span>{approvalLabels[item.category]}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><a href={item.href}>Otvoriť</a></li>)}</ol> : unavailableSources.length ? null : <p className="work-approval-empty">✓ Momentálne nič nečaká na vaše rozhodnutie.</p>}
    {isSuperadmin && items.length > 8 ? <a className="assistant-text-link" href="/admin/automatizacie">Zobraziť všetkých {items.length} schválení →</a> : null}
  </section>;
}

function TaskFields({ item, assignees, isSuperadmin, suggestedOwnerEmail = '', suggestedDueDate = '' }: {
  item?: AdminWorkItem; assignees: AdminTaskAssignee[]; isSuperadmin: boolean; suggestedOwnerEmail?: string; suggestedDueDate?: string;
}) {
  return <div className="work-task-fields">
    <label className="work-field-wide">Názov úlohy<input name="title" required minLength={3} maxLength={120} defaultValue={item?.title} placeholder="Napr. zavolať zákazníkovi" /></label>
    <label>Priorita<select name="priority" defaultValue={item?.priority || 'NORMAL'}><option value="CRITICAL">Kritická</option><option value="HIGH">Vysoká</option><option value="NORMAL">Bežná</option><option value="LOW">Nízka</option></select></label>
    <label>Termín<input name="dueDate" type="date" defaultValue={item?.dueDate || suggestedDueDate} /></label>
    <label>Vlastník<select name="ownerEmail" defaultValue={item?.ownerEmail || suggestedOwnerEmail}><option value="">Zatiaľ nepriradená</option>{assignees.map((person) => <option value={person.email} key={person.email}>{person.name}{person.role === 'SUPER_ADMIN' ? ' · superadmin' : ''}</option>)}</select></label>
    {isSuperadmin ? <label>Viditeľnosť<select name="visibility" defaultValue={item?.visibility || 'TEAM'}><option value="TEAM">Celý tím</option><option value="SUPER_ADMIN">Iba superadmin</option></select></label> : <input type="hidden" name="visibility" value="TEAM" />}
    <label className="work-field-wide">Poznámka<textarea name="note" rows={3} maxLength={1200} defaultValue={item?.note} placeholder="Čo presne treba urobiť a aký má byť výsledok?" /></label>
  </div>;
}

function HiddenActionFields({ csrf, returnTo, item, status }: { csrf: string; returnTo: string; item: AdminWorkItem; status?: string }) {
  return <><input type="hidden" name="_csrf" value={csrf} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} />{status ? <input type="hidden" name="status" value={status} /> : null}</>;
}

function WorkQueueCard({ item, csrf, returnTo, assignees, isSuperadmin, today }: {
  item: AdminWorkQueueItem; csrf: string; returnTo: string; assignees: AdminTaskAssignee[]; isSuperadmin: boolean; today: string;
}) {
  if (item.source === 'automatic') return <article className={`work-item is-auto is-${item.tone}`}>
    <div className="work-item-top"><span className="work-source-badge">Automaticky</span><span className="work-priority-text">{item.tone === 'critical' ? 'Kritické' : item.tone === 'warning' ? 'Upozornenie' : 'Odporúčanie'}</span></div>
    <div className="work-item-body"><div><p>{item.eyebrow}</p><h3>{item.title}</h3><span>{item.detail}</span></div>{item.metric ? <strong className="work-item-metric">{item.metric}</strong> : null}</div>
    <div className="work-item-footer"><span>Zdrojový stav sa po vyriešení automaticky prepočíta.</span><a href={item.href}>{item.actionLabel} →</a></div>
  </article>;

  const task = item.manualItem!;
  const owner = assignees.find((person) => person.email === task.ownerEmail);
  const dueLabel = task.dueDate ? `${task.dueDate < today ? 'Po termíne · ' : task.dueDate === today ? 'Dnes · ' : ''}${shortDate(task.dueDate)}` : 'Bez termínu';
  return <article className={`work-item is-manual is-${item.tone} is-status-${task.status.toLowerCase()}`}>
    <div className="work-item-top"><span className="work-source-badge">Manuálne</span><span className="work-priority-text">{priorityLabels[task.priority]}</span>{task.visibility === 'SUPER_ADMIN' ? <span className="work-owner-badge">Iba superadmin</span> : null}</div>
    <div className="work-item-body"><div><p>{dueLabel}</p><h3>{task.title}</h3><span>{task.note || 'Bez doplňujúcej poznámky.'}</span></div></div>
    <div className="work-task-meta"><span>{owner ? `Vlastník: ${owner.name}` : 'Treba priradiť vlastníka'}</span>{task.status === 'DONE' ? <span>Dokončené</span> : task.status === 'CANCELLED' ? <span>Zrušené: {task.cancelReason}</span> : null}</div>
    <div className="work-manual-actions">
      {task.status === 'OPEN' ? <>
        <form action={transitionAdminWorkItemAction}><HiddenActionFields csrf={csrf} returnTo={returnTo} item={task} status="DONE" /><input type="hidden" name="cancelReason" value="" /><button className="work-button is-success" type="submit">Dokončiť</button></form>
        <details className="work-inline-details"><summary>Upraviť</summary><form action={updateAdminWorkItemAction} className="work-inline-form"><HiddenActionFields csrf={csrf} returnTo={returnTo} item={task} /><TaskFields item={task} assignees={assignees} isSuperadmin={isSuperadmin} /><button className="work-button is-primary" type="submit">Uložiť zmeny</button></form></details>
        <details className="work-inline-details is-cancel"><summary>Zrušiť</summary><form action={transitionAdminWorkItemAction} className="work-cancel-form"><HiddenActionFields csrf={csrf} returnTo={returnTo} item={task} status="CANCELLED" /><label>Dôvod zrušenia<input name="cancelReason" required minLength={3} maxLength={500} /></label><button className="work-button is-danger" type="submit">Potvrdiť zrušenie</button></form></details>
      </> : <form action={transitionAdminWorkItemAction}><HiddenActionFields csrf={csrf} returnTo={returnTo} item={task} status="OPEN" /><input type="hidden" name="cancelReason" value="" /><button className="work-button is-secondary" type="submit">Znovu otvoriť</button></form>}
    </div>
  </article>;
}

export default async function BusinessAssistantPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const adminUser = await requireAdminUser();
  const rawParams = await searchParams;
  const scalar = (key: string) => typeof rawParams?.[key] === 'string' ? rawParams[key] as string : '';
  const filters = normalizeAdminWorkQueueFilters({ view: scalar('view'), source: scalar('source'), q: scalar('q') });
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(new Date());
  const [briefing, workItems, assignees, manualCounts, approvals, taskSuggestion] = await Promise.all([
    getBusinessAssistantBriefing(adminUser.role),
    listAdminWorkItems(adminUser.role, 250, {
      view: filters.view, source: filters.source, query: filters.query, currentEmail: adminUser.email, today,
    }),
    listAdminTaskAssignees(),
    countAdminWorkItems(adminUser.role, adminUser.email, today),
    adminUser.role === 'SUPER_ADMIN' ? getAdminApprovalQueue(adminUser.role) : getAdminOperationalApprovalQueue(),
    getAdminWorkItemSuggestion({ actorRole: adminUser.role, priority: 'NORMAL', visibility: 'TEAM' }).catch(() => null),
  ]);
  const queue = buildAdminWorkQueue({ priorities: briefing.priorities, workItems, manualCounts, today: briefing.today, currentEmail: adminUser.email, filters });
  const csrf = csrfTokenForEmail(adminUser.email);
  const returnParams = new URLSearchParams();
  if (filters.view !== 'all') returnParams.set('view', filters.view);
  if (filters.source !== 'all') returnParams.set('source', filters.source);
  if (filters.query) returnParams.set('q', filters.query);
  const returnTo = `/admin/asistent${returnParams.size ? `?${returnParams}` : ''}`;
  const notice = noticeMessages[scalar('notice')];
  const generated = new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(briefing.generatedAt));
  const isSuperadmin = adminUser.role === 'SUPER_ADMIN';
  const groups = (Object.keys(groupLabels) as Array<keyof typeof groupLabels>).map((key) => ({ key, items: queue.items.filter((item) => item.group === key) })).filter((group) => group.items.length);
  const sourceHref = (source: string) => `/admin/asistent?${new URLSearchParams({ ...(filters.view !== 'all' ? { view: filters.view } : {}), ...(source !== 'all' ? { source } : {}), ...(filters.query ? { q: filters.query } : {}) })}`;
  const suggestionApplied = scalar('suggestion') === 'apply' && Boolean(taskSuggestion);
  const suggestionParams = new URLSearchParams({ ...(filters.view !== 'all' ? { view: filters.view } : {}), ...(filters.source !== 'all' ? { source: filters.source } : {}), ...(filters.query ? { q: filters.query } : {}), suggestion: 'apply' });
  const createRequestId = randomUUID();
  const dismissDecisionId = randomUUID();

  return <main className="admin-page assistant-page work-page">
    <header className="work-hero">
      <div><p>Operatívne centrum · {isSuperadmin ? 'majiteľský pohľad' : 'tímový pohľad'}</p><h1>Čo treba vyriešiť dnes</h1><span>Aktualizované {generated}. Automatické odporúčania iba čítajú aktuálny stav; nič samy neposielajú ani nemenia.</span></div>
      <div className="work-hero-actions"><a className="work-button is-primary" href="#schvalenia">Skontrolovať rozhodnutia</a><a className="work-button is-quiet" href="#nova-uloha">+ Pridať úlohu</a></div>
    </header>

    {notice ? <p className={`work-notice is-${notice[1]}`} role={notice[1] === 'error' ? 'alert' : 'status'} aria-live={notice[1] === 'error' ? 'assertive' : 'polite'} tabIndex={-1}>{notice[0]}</p> : null}

    <nav className="work-pulse" aria-label="Rýchle filtre práce">
      <a className="is-overdue" href="/admin/asistent?view=overdue"><span>Po termíne</span><strong>{queue.counts.overdue}</strong></a>
      <a className="is-today" href="/admin/asistent?view=today"><span>Dnes</span><strong>{queue.counts.today}</strong></a>
      <a href="/admin/asistent?view=mine"><span>Moje otvorené</span><strong>{queue.counts.mine}</strong></a>
      <a className="is-unassigned" href="/admin/asistent?view=unassigned"><span>Bez vlastníka</span><strong>{queue.counts.unassigned}</strong></a>
      <a className="is-done" href="/admin/asistent?view=done_today"><span>Hotové dnes</span><strong>{queue.counts.doneToday}</strong></a>
    </nav>

    <div id="schvalenia"><ApprovalInbox items={approvals.items} unavailableSources={approvals.unavailableSources} isSuperadmin={isSuperadmin} /></div>

    <section className="work-filter-panel" aria-label="Filtrovanie pracovnej fronty">
      <div className="work-view-tabs">
        {[['all', 'Všetko'], ['critical', 'Kritické'], ['mine', 'Moje'], ['unassigned', 'Bez vlastníka'], ['done', 'Hotové'], ['cancelled', 'Zrušené']].map(([value, label]) => <a className={filters.view === value ? 'is-active' : ''} href={`/admin/asistent?${new URLSearchParams({ ...(value !== 'all' ? { view: value } : {}), ...(filters.source !== 'all' ? { source: filters.source } : {}), ...(filters.query ? { q: filters.query } : {}) })}`} key={value}>{label}</a>)}
      </div>
      <form action="/admin/asistent" method="get" className="work-search-form">
        {filters.view !== 'all' ? <input type="hidden" name="view" value={filters.view} /> : null}
        <label>Zdroj<select name="source" defaultValue={filters.source}><option value="all">Všetky</option><option value="automatic">Automatické</option><option value="manual">Manuálne</option></select></label>
        <label className="work-search-label">Hľadať<input name="q" defaultValue={filters.query} maxLength={80} placeholder="Názov, poznámka alebo vlastník" /></label>
        <button className="work-button is-secondary" type="submit">Použiť</button>
        {(filters.query || filters.view !== 'all' || filters.source !== 'all') ? <a className="work-reset" href="/admin/asistent">Zrušiť filtre</a> : null}
      </form>
      <div className="work-source-switch"><span>Zdroj:</span><a className={filters.source === 'all' ? 'is-active' : ''} href={sourceHref('all')}>Všetky</a><a className={filters.source === 'automatic' ? 'is-active' : ''} href={sourceHref('automatic')}>Automatické</a><a className={filters.source === 'manual' ? 'is-active' : ''} href={sourceHref('manual')}>Manuálne</a></div>
    </section>

    <div className="work-layout">
      <section className="work-queue" aria-labelledby="work-queue-title">
        <div className="work-section-heading"><div><p>Zoradené podľa rizika a termínu</p><h2 id="work-queue-title">Pracovná fronta</h2></div><span>{queue.items.length} položiek</span></div>
        {groups.length ? groups.map((group) => <section className={`work-group is-${group.key.toLowerCase()}`} key={group.key}>
          <header><div><h3>{groupLabels[group.key][0]}</h3><p>{groupLabels[group.key][1]}</p></div><strong>{group.items.length}</strong></header>
          <div className="work-group-list">{group.items.map((item) => <WorkQueueCard item={item} csrf={csrf} returnTo={returnTo} assignees={assignees} isSuperadmin={isSuperadmin} today={briefing.today} key={item.id} />)}</div>
        </section>) : <div className="work-empty"><span aria-hidden="true">✓</span><h3>{filters.view === 'all' && filters.source === 'all' && !filters.query ? 'Na dnes nie je nič otvorené' : 'Tomuto filtru nič nezodpovedá'}</h3><p>{filters.view === 'all' && filters.source === 'all' && !filters.query ? 'Automatické kontroly nevidia otvorený problém. Môžete pridať vlastnú internú úlohu.' : 'Skúste zmeniť filter alebo vyhľadávanie.'}</p>{filters.view === 'all' && filters.source === 'all' && !filters.query ? <a href="#nova-uloha">Pridať manuálnu úlohu</a> : <a href="/admin/asistent">Zobraziť všetko</a>}</div>}
      </section>

      <aside className="work-side">
        <section className="work-create-card" id="nova-uloha">
          <div><p>Ručný ďalší krok</p><h2>Nová úloha</h2><span>Úlohu môže tím kedykoľvek upraviť, dokončiť alebo zrušiť.</span></div>
          {taskSuggestion ? <aside className="work-assignment-suggestion" aria-label="Návrh vlastníka a termínu">
            <div><span>Návrh asistenta</span><strong>{taskSuggestion.suggestedOwnerName} · {shortDate(taskSuggestion.suggestedDueDate)}</strong><small>Vybraný je aktívny oprávnený účet s najnižšou otvorenou administratívnou záťažou. Ide len o návrh; pred uložením ho môžete zmeniť.</small>{isSuperadmin ? <small>Interné skóre záťaže: {taskSuggestion.loadScore}</small> : null}</div>
            {suggestionApplied ? <form action={dismissAdminWorkItemSuggestionAction}>
              <input type="hidden" name="_csrf" value={csrf} /><input type="hidden" name="decisionId" value={dismissDecisionId} />
              <input type="hidden" name="sourceRevision" value={taskSuggestion.sourceRevision} /><input type="hidden" name="suggestionVersion" value={taskSuggestion.suggestionVersion} />
              <button className="work-button is-quiet" type="submit">Ponechať nepriradené</button>
            </form> : <a className="work-button is-secondary" href={`/admin/asistent?${suggestionParams}#nova-uloha`}>Použiť návrh</a>}
          </aside> : <p className="work-notice is-warning">Návrh vlastníka nie je dostupný. Úlohu môžete stále priradiť ručne.</p>}
          <form action={createAdminWorkItemAction}>
            <input type="hidden" name="_csrf" value={csrf} /><input type="hidden" name="returnTo" value={returnTo} /><input type="hidden" name="requestId" value={createRequestId} />
            {suggestionApplied && taskSuggestion ? <><input type="hidden" name="suggestionApplied" value="1" /><input type="hidden" name="sourceRevision" value={taskSuggestion.sourceRevision} /><input type="hidden" name="suggestionVersion" value={taskSuggestion.suggestionVersion} /><input type="hidden" name="suggestedOwnerEmail" value={taskSuggestion.suggestedOwnerEmail} /><input type="hidden" name="suggestedDueDate" value={taskSuggestion.suggestedDueDate} /><input type="hidden" name="suggestedPriority" value="NORMAL" /><input type="hidden" name="suggestedVisibility" value="TEAM" /></> : null}
            <TaskFields assignees={assignees} isSuperadmin={isSuperadmin} suggestedOwnerEmail={suggestionApplied ? taskSuggestion?.suggestedOwnerEmail : ''} suggestedDueDate={suggestionApplied ? taskSuggestion?.suggestedDueDate : ''} />
            <button className="work-button is-primary" type="submit">Uložiť úlohu</button>
          </form>
        </section>
        <section className="work-plan-card"><div className="work-section-heading"><div><p>Najbližšie akcie</p><h2>Plán práce</h2></div><a href="/admin/planovac">Plánovač</a></div><PlannerList title="Dnes" date={briefing.today} actions={briefing.planner.today} /><PlannerList title="Zajtra" date={briefing.tomorrow} actions={briefing.planner.tomorrow} /></section>
      </aside>
    </div>

    <details className="admin-card work-disclosure"><summary><span><strong>Fronty podľa zdroja</strong><small>Nové dopyty, follow-upy a nacenenie</small></span><span>Zobraziť</span></summary><div className="assistant-queue-grid"><LeadQueue title="Nové" note="Bez prvého kontaktu" leads={briefing.leads.new} empty="Žiadny nový dopyt." href="/admin/dopyty?queue=new" /><LeadQueue title="Follow-up" note="Dnes alebo po termíne" leads={briefing.leads.followups} empty="Žiadny splatný follow-up." href="/admin/dopyty?queue=followup" /><LeadQueue title="Na nacenenie" note="Ponuku schvaľuje človek" leads={briefing.leads.quote} empty="Žiadny dopyt v tejto fronte." href="/admin/dopyty?queue=quote" /></div></details>

    {isSuperadmin && briefing.superadmin ? <details className="admin-card work-disclosure work-owner-disclosure"><summary><span><strong>Majiteľský prehľad</strong><small>Financie, kvalita dát, systém a obchodný tok · iba superadmin</small></span><span>Zobraziť</span></summary><div className="work-owner-content"><p className="admin-muted-note">Financie vychádzajú iba zo skutočne zaevidovaných dokladov. Čísla toku sú samostatné počty udalostí v aktuálnom mesiaci, nie konverzné percentá jednej kohorty.</p><div className="assistant-owner-grid"><article><span>Aktuálne po splatnosti</span><strong>{euroCents(briefing.superadmin.finance.currentOverdueCents)}</strong><small>Podľa faktúr a úhrad</small></article><article><span>Aktuálne neuhradené</span><strong>{euroCents(briefing.superadmin.finance.currentOutstandingCents)}</strong><small>{briefing.superadmin.finance.jobsWithEvidence} zákaziek s dokladom</small></article><article><span>Nepriradené úhrady</span><strong>{euroCents(briefing.superadmin.finance.currentUnallocatedCents)}</strong><small>Vyžadujú kontrolu</small></article><article><span>Zákazky bez nákladov</span><strong>{briefing.superadmin.jobsWithoutRecordedDirectCosts}</strong><small>Aktuálny mesiac</small></article><article><span>Evidované ceny zákaziek</span><strong>{euro(briefing.superadmin.business.recordedOrderValue)}</strong><small>Nie je to prijatá platba</small></article><article><span>Zadané náklady a odmeny</span><strong>{euro(briefing.superadmin.business.recordedDirectCosts)}</strong><small>{briefing.superadmin.business.activeJobs} aktívnych záznamov</small></article></div><div className="assistant-owner-details"><div><p>Kontrola prevádzky</p><h2>Systém</h2><ul><li className={briefing.superadmin.health.database.ok ? 'is-ok' : 'is-error'}><strong>Databáza</strong><span>{briefing.superadmin.health.database.detail}</span></li><li className={briefing.superadmin.health.storage.ok ? 'is-ok' : 'is-warning'}><strong>Úložisko</strong><span>{briefing.superadmin.health.storage.detail}</span></li><li className={`is-${briefing.superadmin.health.leadMail.level}`}><strong>Dopytové emaily</strong><span>{briefing.superadmin.health.leadMail.detail}</span></li></ul></div><div><p>Aktuálny mesiac · udalosti</p><h2>Obchodný tok</h2><ol className="assistant-funnel"><li><span>Dopyty</span><strong>{briefing.superadmin.funnel.leadsReceived}</strong></li><li><span>Prvý kontakt</span><strong>{briefing.superadmin.funnel.contactedLeads}</strong></li><li><span>Vytvorené ponuky</span><strong>{briefing.superadmin.funnel.offersCreated}</strong></li><li><span>Odoslané ponuky</span><strong>{briefing.superadmin.funnel.offersSent}</strong></li><li><span>Prijaté ponuky</span><strong>{briefing.superadmin.funnel.offersAccepted}</strong></li><li><span>Dokončené realizácie</span><strong>{briefing.superadmin.funnel.completedJobs}</strong></li><li><span>Zákazky s účinnou úhradou</span><strong>{briefing.superadmin.funnel.paidJobs}</strong></li><li><span>Prijaté referencie</span><strong>{briefing.superadmin.funnel.reviewsReceived}</strong></li></ol></div></div></div></details> : null}

    <section className="admin-card assistant-guardrail" aria-labelledby="assistant-guardrail-title"><div><span aria-hidden="true">✓</span></div><div><p>Bezpečnostná poistka</p><h2 id="assistant-guardrail-title">Fronta sama nič neodosiela</h2><span>Fronta iba odporúča poradie práce a spravuje interné úlohy. Cenová ponuka, follow-up, prvá žiadosť o referenciu, platba, reklama, publikovanie fotografie aj odstránenie zdrojového záznamu zostávajú v pôvodnom schvaľovanom postupe. Transakčné potvrdenia a vopred povolená jediná pripomienka referencie majú samostatný bezpečný proces.</span></div></section>
  </main>;
}
