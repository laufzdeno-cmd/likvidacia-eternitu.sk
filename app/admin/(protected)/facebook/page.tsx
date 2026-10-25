import { csrfTokenForEmail, requireFacebookAdminUser } from '@/src/server/auth';
import { getFacebookMessengerConfiguration } from '@/src/server/facebook-messenger-config';
import { getFacebookConversationCounts, getFacebookPageConnection, listFacebookConversations } from '@/src/server/facebook-messenger-db';
import type { FacebookConversationStatus } from '@/src/server/facebook-messenger-types';
import { listAdminTaskAssignees } from '@/src/server/db';
import { disconnectFacebookPageAction } from './actions';
import './facebook.css';

const statusLabels: Record<FacebookConversationStatus, string> = {
  nova: 'Nová',
  riesi_sa: 'Rieši sa',
  cakame_na_zakaznika: 'Čakáme na zákazníka',
  vybavena: 'Vybavená',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(value));
}
export default async function FacebookInboxPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const admin = await requireFacebookAdminUser();
  const isReviewer = admin.role === 'META_REVIEWER';
  const config = getFacebookMessengerConfiguration();
  const reviewParticipantId = isReviewer ? config.reviewParticipantId || '__reviewer_not_configured__' : '';
  const query = searchParams ? await searchParams : {};
  const status = ['nova', 'riesi_sa', 'cakame_na_zakaznika', 'vybavena'].includes(query.status || '')
    ? query.status as FacebookConversationStatus
    : undefined;
  const [connection, counts, assignees, conversations] = await Promise.all([
    getFacebookPageConnection(),
    getFacebookConversationCounts(reviewParticipantId),
    isReviewer ? Promise.resolve([]) : listAdminTaskAssignees(),
    listFacebookConversations({ status, assignedTo: isReviewer ? undefined : query.assigned || undefined, unreadOnly: query.unread === '1', participantId: reviewParticipantId }),
  ]);
  const csrfToken = csrfTokenForEmail(admin.email);
  const connectMessage = query.connect === 'ok' ? 'Facebook stránka bola pripojená a webhook je prihlásený.'
    : query.connect === 'disconnected' ? 'Facebook stránka bola odpojená.'
      : query.connect === 'configuration' ? 'Najprv treba doplniť bezpečnú konfiguráciu Meta vo Verceli.'
        : query.connect === 'state' ? 'Platnosť pripojenia vypršala. Spustite ho znova.'
          : query.connect === 'failed' ? 'Meta pripojenie sa nepodarilo dokončiť. Skontrolujte oprávnenia firemnej stránky.' : '';

  return (
    <main className="admin-page facebook-admin-page">
      <div className="admin-heading">
        <div><p>KOMUNIKÁCIA</p><h1>Facebook správy</h1><p>Spoločná schránka firemnej Facebook stránky.</p></div>
        {connection ? <span className="facebook-live-badge">Pripojené</span> : <span className="facebook-offline-badge">Nepripojené</span>}
      </div>
      {connectMessage ? <p className={query.connect === 'ok' || query.connect === 'disconnected' ? 'facebook-notice' : 'admin-alert'} role="status">{connectMessage}</p> : null}
      {query.access === 'restricted' && isReviewer ? <p className="facebook-notice" role="status">Kontrolný účet má zámerne prístup iba k Facebook správam.</p> : null}
      {isReviewer && !config.reviewParticipantId ? <p className="admin-alert" role="status">Kontrolná konverzácia ešte nie je priradená. Tento účet dovtedy nevidí žiadne správy.</p> : null}

      <section className="admin-card facebook-connection-card" aria-labelledby="facebook-connection-title">
        <div>
          <p className="facebook-eyebrow">PREPOJENIE</p>
          <h2 id="facebook-connection-title">{connection ? connection.pageName : 'Firemná Facebook stránka'}</h2>
          {connection ? (
            <p>Správy sa prijímajú cez podpísaný webhook. Posledný prijatý webhook: <strong>{connection.lastWebhookAt ? formatDate(connection.lastWebhookAt) : 'zatiaľ neprišiel'}</strong>.</p>
          ) : (
            <p>{config.configured ? 'Konfigurácia je pripravená. Superadmin môže bezpečne pripojiť presne určenú Facebook stránku.' : 'Modul je bezpečne vypnutý, kým sa nedoplní konfigurácia a nepripojí konkrétna stránka.'}</p>
          )}
        </div>
        <div className="admin-action-row">
          {!connection && admin.role === 'SUPER_ADMIN' && config.configured ? <a className="admin-primary-link" href="/api/meta/messenger/oauth/start">Pripojiť cez Meta</a> : null}
          {connection && admin.role === 'SUPER_ADMIN' ? (
            <form action={disconnectFacebookPageAction} data-confirm-submit="Naozaj odpojiť Facebook správy? Nové správy sa prestanú prijímať.">
              <input type="hidden" name="_csrf" value={csrfToken} />
              <input type="hidden" name="pageId" value={connection.pageId} />
              <button className="admin-danger-outline" type="submit">Odpojiť</button>
            </form>
          ) : null}
        </div>
        {!config.configured && admin.role === 'SUPER_ADMIN' ? <p className="facebook-config-note">Chýbajúce nastavenia: {config.missing.join(', ')}. Heslo Facebooku sa sem nikdy nezadáva.</p> : null}
      </section>

      <section className="facebook-stat-grid" aria-label="Prehľad Facebook správ">
        <article><span>Nové správy</span><strong>{counts.unread}</strong></article>
        <article><span>Otvorené</span><strong>{counts.open}</strong></article>
        <article><span>Bez pridelenia</span><strong>{counts.unassigned}</strong></article>
        <article><span>Čakáme na zákazníka</span><strong>{counts.waiting}</strong></article>
      </section>

      <section className="admin-card">
        <div className="facebook-section-heading"><div><p className="facebook-eyebrow">DORUČENÉ</p><h2>Konverzácie</h2></div><span>{conversations.length} z {counts.all}</span></div>
        <form className="admin-filter-bar" method="get" action="/admin/facebook">
          <label>Stav<select name="status" defaultValue={status || ''}><option value="">Všetky stavy</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {!isReviewer ? <label>Pridelenie<select name="assigned" defaultValue={query.assigned || ''}><option value="">Všetci</option><option value="none">Bez pridelenia</option>{assignees.map((item) => <option key={item.id} value={item.email}>{item.name || item.email}</option>)}</select></label> : null}
          <label className="admin-checkbox"><input type="checkbox" name="unread" value="1" defaultChecked={query.unread === '1'} /> Iba nové</label>
          <button type="submit">Použiť filter</button>
          <a href="/admin/facebook">Vyčistiť</a>
        </form>
        {!connection ? <div className="facebook-empty"><strong>Schránka ešte nie je pripojená.</strong><span>Po pripojení sa nové správy zobrazia tu. Staršiu históriu Meta webhook automaticky nedoplní.</span></div>
          : conversations.length ? <div className="facebook-conversation-list">{conversations.map((item) => (
            <a href={`/admin/facebook/${item.id}`} className={item.unreadCount ? 'facebook-conversation is-unread' : 'facebook-conversation'} key={item.id}>
              <span className="facebook-avatar" aria-hidden="true">{item.participantName.charAt(0).toUpperCase()}</span>
              <span className="facebook-conversation-copy"><strong>{item.participantName}</strong><small>{item.lastMessagePreview || 'Správa bez textu'}</small></span>
              <span className="facebook-conversation-meta"><time dateTime={item.lastMessageAt}>{formatDate(item.lastMessageAt)}</time><span className={`facebook-status status-${item.status}`}>{statusLabels[item.status]}</span>{item.unreadCount ? <b>{item.unreadCount}</b> : null}</span>
            </a>
          ))}</div> : <div className="facebook-empty"><strong>Vo filtri nie sú žiadne konverzácie.</strong><span>Zmeňte filter alebo počkajte na novú správu.</span></div>}
      </section>
    </main>
  );
}
