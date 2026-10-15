import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { getPriceOffer } from '@/src/server/db';
import { buildOfferFollowUpDraft } from '@/src/lib/admin-operations';
import { resolveUnknownPriceOfferFollowUpAction, sendPriceOfferFollowUpAction } from '../../actions';

type FollowUpHistory = {
  id: string;
  createdAt: string;
  createdBy: string;
  status: 'sending' | 'sent' | 'failed' | 'unknown';
  subject: string;
  messageId: string;
  updatedAt: string;
  revision: number;
};

type FollowUpReadPersistence = {
  listPriceOfferFollowUps(offerId: string): Promise<FollowUpHistory[]>;
};

async function historyFor(offerId: string) {
  const persistence = await import('@/src/server/db') as unknown as FollowUpReadPersistence;
  return typeof persistence.listPriceOfferFollowUps === 'function' ? persistence.listPriceOfferFollowUps(offerId) : [];
}

const followUpStatusLabel: Record<FollowUpHistory['status'], string> = {
  sending: 'Odosiela sa',
  sent: 'Odoslaný',
  failed: 'Neodoslaný',
  unknown: 'Treba overiť',
};

export default async function OfferFollowUpPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const [adminUser, offer, history] = await Promise.all([requireAdminUser(), getPriceOffer(id), historyFor(id)]);
  if (!offer || offer.deletedAt) notFound();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const draft = buildOfferFollowUpDraft(offer, today);
  const hasUnresolvedDelivery = history.some((item) => item.status === 'sending' || item.status === 'unknown');
  const hasSentFollowUp = history.some((item) => item.status === 'sent');
  const canSend = offer.status === 'ODOSLANA' && !hasUnresolvedDelivery && !hasSentFollowUp;

  return (
    <main className="admin-page ops-page">
      <div className="admin-heading ops-heading">
        <div><p>Manuálne schvaľovaný kontakt</p><h1>Follow-up ponuky {offer.number}</h1><span>Systém pripraví návrh. Email odíde iba po vašej kontrole a výslovnom potvrdení.</span></div>
        <a className="admin-secondary-link" href={`/admin/ponuky/${offer.id}`}>Späť na ponuku</a>
      </div>
      {query.sent ? <p className="ops-notice" role="status">Follow-up bol odoslaný a zaevidovaný.</p> : null}
      {query.resolved === 'sent' ? <p className="ops-notice" role="status">Výsledok bol manuálne potvrdený ako odoslaný.</p> : null}
      {query.resolved === 'not_sent' ? <p className="ops-notice" role="status">Bolo potvrdené, že email neodišiel. Follow-up možno po kontrole skúsiť znova.</p> : null}
      {query.error ? <p className="ops-alert ops-alert-danger" role="alert">{query.error.slice(0, 300)}</p> : null}

      <section className="admin-card ops-panel">
        <div className="ops-section-heading"><div><span>Koncept</span><h2>Skontrolovať pred odoslaním</h2></div><p>Adresát: <strong>{offer.contactPerson}</strong> · {offer.email}</p></div>
        {canSend ? <form className="admin-quote-form" action={sendPriceOfferFollowUpAction}>
          <input type="hidden" name="_csrf" value={csrfTokenForEmail(adminUser.email)} />
          <input type="hidden" name="offerId" value={offer.id} />
          <input type="hidden" name="operationId" value={randomUUID()} />
          <label className="admin-form-wide">Predmet<input name="subject" required minLength={3} maxLength={180} defaultValue={draft.subject} /></label>
          <label className="admin-form-wide">Text emailu<textarea name="body" required minLength={20} maxLength={4000} rows={12} defaultValue={draft.body} /></label>
          <label className="admin-check-label admin-form-wide"><input type="checkbox" name="confirmed" value="yes" required /> Skontroloval/a som adresáta, predmet aj celý text a chcem tento email odoslať.</label>
          <div className="admin-form-wide admin-action-row"><button type="submit" className="admin-primary-button">Potvrdiť a odoslať follow-up</button><a className="admin-secondary-link" href={`/admin/ponuky/${offer.id}`}>Neodosielať</a></div>
        </form> : <div className="ops-empty"><strong>{hasSentFollowUp ? 'Jediný follow-up už bol odoslaný.' : 'Follow-up teraz nemožno odoslať.'}</strong><p>{hasSentFollowUp
          ? 'Ďalší automatizovaný follow-up systém nepovolí. Zaevidujte odpoveď zákazníka alebo výsledok ponuky.'
          : hasUnresolvedDelivery
          ? 'Pred ďalším pokusom treba uzavrieť neistý alebo stále spracovávaný výsledok v histórii nižšie.'
          : `Ponuka musí byť odoslaná a nesmie byť prijatá, zrušená ani archivovaná. Aktuálny stav: ${offer.status}.`}</p></div>}
      </section>

      <section className="admin-card ops-panel">
        <div className="ops-section-heading"><div><span>Audit</span><h2>História follow-upov</h2></div><p>Neistý výsledok nikdy neopakujte bez kontroly odoslanej pošty.</p></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Dátum</th><th>Predmet</th><th>Stav</th><th>Vytvoril</th><th>Overenie</th></tr></thead>
          <tbody>{history.map((item) => <tr key={item.id}><td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Bratislava' }).format(new Date(item.createdAt))}</td><td>{item.subject}</td><td><span className={`status-pill status-${item.status}`}>{followUpStatusLabel[item.status]}</span></td><td>{item.createdBy}</td><td>{item.status === 'unknown' ? <div className="ops-stack">
            <form action={resolveUnknownPriceOfferFollowUpAction} className="review-reminder-form">
              <input type="hidden" name="_csrf" value={csrfTokenForEmail(adminUser.email)} /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="offerId" value={offer.id} /><input type="hidden" name="expectedRevision" value={item.revision} /><input type="hidden" name="resolution" value="sent" /><input type="hidden" name="operationId" value={randomUUID()} />
              <select name="evidenceCode" required defaultValue=""><option value="" disabled>Ako ste odoslanie overili?</option><option value="provider_accepted">Poskytovateľ potvrdil prijatie</option><option value="sent_folder_verified">Správa je v odoslanej pošte</option><option value="recipient_confirmed">Zákazník prijatie potvrdil</option></select>
              <label className="admin-check-label"><input type="checkbox" name="confirmedResolution" value="yes" required /> Overil/a som, že email odišiel.</label><button type="submit" className="admin-secondary-button">Potvrdiť odoslanie</button>
            </form>
            <form action={resolveUnknownPriceOfferFollowUpAction} className="review-reminder-form">
              <input type="hidden" name="_csrf" value={csrfTokenForEmail(adminUser.email)} /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="offerId" value={offer.id} /><input type="hidden" name="expectedRevision" value={item.revision} /><input type="hidden" name="resolution" value="not_sent" /><input type="hidden" name="operationId" value={randomUUID()} />
              <select name="evidenceCode" required defaultValue=""><option value="" disabled>Ako ste neodoslanie overili?</option><option value="provider_no_record">Poskytovateľ nemá záznam</option><option value="sent_folder_empty">Správa nie je v odoslanej pošte</option></select>
              <label className="admin-check-label"><input type="checkbox" name="confirmedResolution" value="yes" required /> Overil/a som, že email neodišiel.</label><button type="submit" className="admin-secondary-button">Povoliť nový pokus</button>
            </form>
          </div> : item.status === 'sending' ? <span>Po 15 minútach obnovte stránku. Neistý pokus sa sprístupní na ručné overenie.</span> : '—'}</td></tr>)}{!history.length ? <tr><td colSpan={5}>K tejto ponuke zatiaľ nebol odoslaný follow-up.</td></tr> : null}</tbody>
        </table></div>
      </section>
    </main>
  );
}
