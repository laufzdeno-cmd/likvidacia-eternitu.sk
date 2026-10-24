import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { getFacebookConversation } from '@/src/server/facebook-messenger-db';
import { facebookReplyWindowEndsAt, isWithinFacebookReplyWindow } from '@/src/server/facebook-messenger-policy';
import { listAdminTaskAssignees, listLeadSummaryPage } from '@/src/server/db';
import { linkFacebookConversationAction, resolveFacebookUnknownDeliveryAction, saveFacebookConversationWorkflowAction, unlinkFacebookConversationAction } from '../actions';
import FacebookReplyComposer from '../facebook-reply-composer';
import '../facebook.css';

const statusLabels = {
  nova: 'Nová',
  riesi_sa: 'Rieši sa',
  cakame_na_zakaznika: 'Čakáme na zákazníka',
  vybavena: 'Vybavená',
} as const;

const attachmentLabels: Record<string, string> = {
  image: 'Fotografia', video: 'Video', audio: 'Zvuk', file: 'Súbor', fallback: 'Príloha',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(value));
}
export default async function FacebookConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdminUser();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const [conversation, assignees, leadsPage] = await Promise.all([
    getFacebookConversation(id),
    listAdminTaskAssignees(),
    listLeadSummaryPage({ page: 1, pageSize: 100, excludeTestData: true }),
  ]);
  if (!conversation) notFound();
  const csrfToken = csrfTokenForEmail(admin.email);
  const canReply = isWithinFacebookReplyWindow(conversation.lastInboundAt);
  const unknownMessage = [...conversation.messages].reverse().find((message) => message.direction === 'outbound' && message.status === 'unknown');
  const windowEndsAt = facebookReplyWindowEndsAt(conversation.lastInboundAt);
  const sendNotice = query.send === 'sent' ? 'Správa bola odoslaná do Meta Messengeru.'
    : query.send === 'failed' ? 'Meta správu odmietla. Nič sa automaticky neopakovalo.'
      : query.send === 'unknown' ? 'Výsledok odoslania je neistý. Pred ďalším pokusom skontrolujte Facebook, aby zákazník nedostal správu dvakrát.'
        : query.send === 'window' ? '24-hodinové okno na bežnú odpoveď už uplynulo. Správa sa neodoslala.'
          : query.send === 'duplicate' ? 'Tento pokus už bol zaznamenaný. Správa sa druhýkrát neodoslala.'
            : query.send === 'configuration' ? 'Facebook pripojenie nie je úplné. Správa sa neodoslala.' : '';

  return (
    <main className="admin-page facebook-admin-page facebook-thread-page">
      <div className="admin-heading">
        <div><p>FACEBOOK KONVERZÁCIA</p><h1>{conversation.participantName}</h1><p>Posledná správa {formatDate(conversation.lastMessageAt)}</p></div>
        <a className="admin-secondary-link" href="/admin/facebook">← Späť na správy</a>
      </div>
      {sendNotice ? <p className={query.send === 'sent' ? 'facebook-notice' : 'admin-alert'} role="status">{sendNotice}</p> : null}

      <div className="facebook-thread-layout">
        <section className="admin-card facebook-thread-card" aria-labelledby="facebook-thread-title">
          <div className="facebook-section-heading"><div><p className="facebook-eyebrow">HISTÓRIA</p><h2 id="facebook-thread-title">Správy</h2></div><span>{conversation.messages.length}</span></div>
          <div className="facebook-messages">
            {conversation.messages.length ? conversation.messages.map((message) => (
              <article className={`facebook-message is-${message.direction}`} key={message.id}>
                <div>
                  {message.text ? <p>{message.text}</p> : null}
                  {message.attachmentTypes.length ? <div className="facebook-attachments">{message.attachmentTypes.map((type, index) => <span key={`${type}-${index}`}>{attachmentLabels[type] || 'Príloha'} — zostáva súkromná vo Facebooku</span>)}</div> : null}
                  {!message.text && !message.attachmentTypes.length ? <p>Správa bez textu</p> : null}
                </div>
                <div className="facebook-message-meta"><time dateTime={message.providerTimestamp}>{formatDate(message.providerTimestamp)}</time>{message.direction === 'outbound' ? <span>{message.status === 'read' ? 'Prečítaná' : message.status === 'delivered' ? 'Doručená' : message.status === 'sent' ? 'Odoslaná' : message.status === 'unknown' ? 'Výsledok neznámy' : message.status === 'failed' ? 'Neodoslaná' : 'Odosiela sa'}</span> : null}{message.sentBy && message.sentBy !== 'facebook-external' ? <span>{message.sentBy}</span> : null}</div>
              </article>
            )) : <div className="facebook-empty"><strong>Bez uložených správ</strong></div>}
          </div>
          <div className={canReply ? 'facebook-window is-open' : 'facebook-window is-closed'}>
            <strong>{canReply ? 'Odpoveď je povolená' : 'Bežná odpoveď je zablokovaná'}</strong>
            <span>{windowEndsAt ? `${canReply ? '24-hodinové okno končí' : 'Okno skončilo'} ${formatDate(windowEndsAt)}.` : 'Najprv musí prísť správa od zákazníka.'}</span>
          </div>
          {unknownMessage ? <form className="facebook-delivery-check" action={resolveFacebookUnknownDeliveryAction}>
            <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={conversation.id} /><input type="hidden" name="messageId" value={unknownMessage.id} />
            <strong>Najprv overte predchádzajúce odoslanie</strong>
            <p>Výsledok správy z {formatDate(unknownMessage.providerTimestamp)} je neznámy. Otvorte firemný Facebook a zistite, či ju zákazník dostal.</p>
            <label className="admin-checkbox"><input type="checkbox" name="checkedFacebook" value="yes" required /> Skontroloval/a som konverzáciu priamo na Facebooku.</label>
            <label>Výsledok<select name="outcome" required><option value="">Vyberte</option><option value="sent">Správa tam je — odoslaná</option><option value="failed">Správa tam nie je — neodoslaná</option></select></label>
            <label>Stručný dôkaz<input name="evidence" minLength={5} maxLength={500} placeholder="napr. skontrolované v Page Inboxe o 10:15" required /></label>
            <button type="submit">Uložiť overený výsledok</button>
          </form> : null}
          <FacebookReplyComposer conversationId={conversation.id} csrfToken={csrfToken} clientRequestId={randomUUID()} disabled={!canReply || Boolean(unknownMessage)} />
        </section>

        <aside className="facebook-thread-sidebar">
          <section className="admin-card">
            <p className="facebook-eyebrow">ZODPOVEDNOSŤ</p><h2>Pracovný stav</h2>
            <form className="facebook-side-form" action={saveFacebookConversationWorkflowAction}>
              <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={conversation.id} />
              <label>Stav<select name="status" defaultValue={conversation.status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Pridelené<select name="assignedTo" defaultValue={conversation.assignedTo}><option value="">Bez pridelenia</option>{assignees.map((item) => <option key={item.id} value={item.email}>{item.name || item.email}</option>)}</select></label>
              <button type="submit">Uložiť stav</button>
            </form>
          </section>

          <section className="admin-card">
            <p className="facebook-eyebrow">CRM</p><h2>Prepojený dopyt</h2>
            {conversation.leadId ? <><p>Konverzácia je prepojená s dopytom.</p><a className="admin-primary-link" href={`/admin/dopyty/${conversation.leadId}`}>Otvoriť dopyt</a><form action={unlinkFacebookConversationAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={conversation.id} /><button className="admin-danger-outline" type="submit">Zrušiť prepojenie</button></form></> : (
              <form className="facebook-side-form" action={linkFacebookConversationAction}>
                <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={conversation.id} />
                <label>Existujúci dopyt<select name="leadId" defaultValue="" required><option value="" disabled>Vyberte dopyt</option>{leadsPage.items.map((lead) => <option key={lead.id} value={lead.id}>{lead.fullName} · {lead.city || 'bez lokality'} · {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short' }).format(new Date(lead.createdAt))}</option>)}</select></label>
                <button type="submit">Prepojiť s dopytom</button>
                <small>Ak dopyt ešte neexistuje, najprv si od zákazníka vypýtajte kontakt a potrebné údaje. Systém nevytvára neúplné ani vymyslené záznamy.</small>
              </form>
            )}
          </section>

          <section className="admin-card facebook-privacy-card"><p className="facebook-eyebrow">SÚKROMIE</p><h2>Bezpečné spracovanie</h2><p>Prílohy sa z Facebooku automaticky nepublikujú. Na web môžu ísť iba neskôr cez existujúce schválenie fotografií.</p></section>
        </aside>
      </div>
    </main>
  );
}
