import { notFound } from 'next/navigation';
import { getLeadWithFiles, getPriceOffer, getPriceOfferSettings, listOperationalBusinessJobs } from '@/src/server/db';
import { toPriceOfferJobOption } from '@/src/lib/price-offer-job-option';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { priceOfferEmailText } from '@/src/server/mail';
import { evaluatePriceOfferPreflight, isPriceOfferLeadStatusOpen, priceOfferApprovalFingerprint } from '@/src/server/price-offer-preflight';
import { dateInBratislava } from '@/src/server/analytics-metrics';
import { confirmPreparedPriceOfferSentExternallyAction, confirmUncertainPriceOfferSentAction, resetUncertainPriceOfferSendAction, resolvePriceOfferCustomerResponseAction, savePriceOfferAction, sendPriceOfferAction, updatePriceOfferStatusAction } from '../actions';
import PriceOfferForm from '../offer-form';
import PendingOfferButton from '../pending-offer-button';
import { euro, priceOfferStatusLabels } from '../constants';
import { getGmailPriceOfferJobForOffer } from '@/src/server/gmail-price-offer-db';

function dateSk(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(value));
}

function isExpired(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
}

function canResetUncertainSend(offer: { status: string; sendStartedAt?: string }) {
  if ((offer.status !== 'NEISTY_STAV' && offer.status !== 'ODOSIELA') || !offer.sendStartedAt) return false;
  return Date.now() - new Date(offer.sendStartedAt).getTime() >= 15 * 60_000;
}

function canConfirmUncertainSend(offer: { status: string; sendStartedAt?: string }) {
  if (offer.status === 'NEISTY_STAV') return true;
  return offer.status === 'ODOSIELA' && canResetUncertainSend(offer);
}

const customerResponseLabels = {
  ACCEPTED: 'Ponuku prijímam',
  DEFERRED: 'Potrebujem viac času',
  DECLINED: 'Ponuku nevyužijem',
} as const;

const customerDeclineReasonLabels: Record<string, string> = {
  price: 'Cena',
  timing: 'Nevyhovuje termín',
  selected_other: 'Vybral/a si inú ponuku',
  no_longer_needed: 'Službu už nepotrebuje',
  other: 'Iný dôvod',
};

export default async function PriceOfferDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const [adminUser, offer, jobs, settings, gmailLabelJob] = await Promise.all([
    requireAdminUser(), getPriceOffer(id), listOperationalBusinessJobs(), getPriceOfferSettings(),
    getGmailPriceOfferJobForOffer(id),
  ]);
  if (!offer) notFound();
  const csrfToken = csrfTokenForEmail(adminUser.email);
  const linkedJob = offer.jobId ? jobs.find((job) => job.id === offer.jobId) : undefined;
  const linkedLeadId = offer.leadId || linkedJob?.leadId;
  const linkedLead = linkedLeadId ? await getLeadWithFiles(linkedLeadId) : null;
  const preflightContext = {
    linkedJobAvailable: !offer.jobId || Boolean(linkedJob && linkedJob.status !== 'ZRUSENA'),
    linkedJobIsTestData: Boolean(linkedJob?.isTestData),
    linkedLeadActive: !linkedLeadId || isPriceOfferLeadStatusOpen(linkedLead?.status),
  };
  const preflight = evaluatePriceOfferPreflight(offer, preflightContext);
  const approvalFingerprint = priceOfferApprovalFingerprint(offer, settings, preflightContext);
  const fullEmailText = priceOfferEmailText(offer, settings);
  const pendingCustomerResponse = Boolean(offer.customerResponse && !offer.customerResponseAppliedAt && !offer.customerResponseDismissedAt);
  const today = dateInBratislava(new Date());

  return (
    <main className="admin-page">
      <div className="admin-heading price-offer-heading">
        <div>
          <p className="admin-status-badge">{priceOfferStatusLabels[offer.status]}</p>
          <h1>Cenová ponuka č. {offer.number}</h1>
        </div>
        <div className="admin-action-row">
          <a className="admin-secondary-link" href={`/api/admin/ponuka/${offer.id}/pdf`} target="_blank">Náhľad PDF</a>
          {offer.status === 'PRIPRAVENA' ? <a className="admin-primary-link" href={`/admin/ponuky/${offer.id}?send=1`}>Odoslať zákazníkovi</a> : null}
          {offer.status === 'ODOSLANA' ? <a className="admin-primary-link" href={`/admin/ponuky/${offer.id}/follow-up`}>Pripraviť pripomienku</a> : null}
          <a className="admin-text-link" href="/admin/ponuky">Späť na ponuky</a>
        </div>
      </div>

      {query.sent ? (
        <section className="admin-card">
          <div className="admin-alert is-success">Cenová ponuka bola odoslaná zákazníkovi.</div>
        </section>
      ) : null}
      {gmailLabelJob?.status === 'completed' ? <section className="admin-card"><div className="admin-alert is-success">Správa je v Gmaili označená zeleným štítkom „✓ CP odoslaná“.</div></section> : null}
      {gmailLabelJob && ['pending', 'processing', 'retry'].includes(gmailLabelJob.status) ? <section className="admin-card"><div className="admin-alert">Ponuka je odoslaná. Označenie v Gmaili sa dokončí automaticky; ponuku neposielajte znova.</div></section> : null}
      {gmailLabelJob?.status === 'attention' ? <section className="admin-card"><div className="admin-alert">Ponuka je odoslaná, ale jej Gmail označenie treba skontrolovať. Superadmin vidí detail v Nastaveniach. Ponuku neposielajte znova.</div></section> : null}
      {query.sendError ? (
        <section className="admin-card">
          <div className="admin-alert">Cenovú ponuku sa nepodarilo odoslať. Detail: {query.sendError}</div>
        </section>
      ) : null}
      {query.sendReset ? <section className="admin-card"><div className="admin-alert is-success">Stav bol po potvrdenej kontrole vrátený na „Pripravená“. E-mail odošlite až po overení, že pôvodný pokus nebol doručený.</div></section> : null}
      {query.sendConfirmed ? <section className="admin-card"><div className="admin-alert is-success">Odoslanie bolo manuálne overené. Ponuka, dopyt aj zákazka majú zosúladený stav.</div></section> : null}
      {query.externalSent ? <section className="admin-card"><div className="admin-alert is-success">Ručné odoslanie bolo zaevidované. Žiadny nový email sa neposlal a stav dopytu aj zákazky je zosúladený.</div></section> : null}
      {query.customerResponse === 'applied' ? <section className="admin-card"><div className="admin-alert is-success">Odpoveď zákazníka bola po kontrole zaevidovaná.</div></section> : null}
      {query.customerResponse === 'dismissed' ? <section className="admin-card"><div className="admin-alert">Odpoveď zákazníka bola označená ako nepoužiteľná. Stav ponuky sa nezmenil.</div></section> : null}
      {offer.status === 'ODOSIELA' ? <section className="admin-card"><div className="admin-alert">Odoslanie ponuky prebieha alebo sa jeho výsledok ešte spracúva. Zatiaľ ju neupravujte ani neodosielajte znova.</div></section> : null}
      {offer.status === 'NEISTY_STAV' ? <section className="admin-card"><div className="admin-alert">Server nepotvrdil výsledok odoslania. Pred ďalším pokusom skontrolujte schránku ASTANA aj odoslanú poštu.</div></section> : null}
      {canConfirmUncertainSend(offer) ? (
        <section className="admin-card">
          <h2>Odoslanie bolo overené</h2>
          <p>Túto možnosť použite iba vtedy, keď máte dôkaz, že pôvodný e-mail odišiel. Nový e-mail sa neposiela.</p>
          <form action={confirmUncertainPriceOfferSentAction} className="admin-pending-form">
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="id" value={offer.id} />
            <label>Spôsob overenia
              <select name="confirmationEvidence" required defaultValue="">
                <option value="" disabled>Vyberte dôkaz</option>
                <option value="sent_folder_verified">Overené v odoslanej pošte</option>
                <option value="recipient_confirmed">Zákazník potvrdil prijatie</option>
                <option value="provider_confirmed">Poskytovateľ potvrdil odoslanie</option>
              </select>
            </label>
            <label className="admin-check-label"><input type="checkbox" name="confirmedSent" value="yes" required /> Potvrdzujem, že ponuka bola odoslaná a nemá sa posielať znova.</label>
            <button className="admin-primary-button" type="submit">Označiť ako overene odoslanú</button>
          </form>
        </section>
      ) : null}
      {canResetUncertainSend(offer) ? (
        <section className="admin-card">
          <h2>Overený opakovaný pokus</h2>
          <p>Možnosť sa zobrazí až 15 minút po pokuse. Stav obnovte iba vtedy, ak ste skontrolovali odoslanú poštu aj schránku ASTANA a pôvodná ponuka neodišla.</p>
          <form action={resetUncertainPriceOfferSendAction} className="admin-pending-form">
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="id" value={offer.id} />
            <label className="admin-check-label"><input type="checkbox" name="confirmedNotSent" value="yes" required /> Potvrdzujem, že som overil schránku a pôvodný e-mail nebol odoslaný.</label>
            <button className="admin-secondary-button" type="submit">Obnoviť na pripravenú</button>
          </form>
        </section>
      ) : null}
      {offer.status === 'PRIPRAVENA' ? (
        <details className="admin-card offer-external-sent-card">
          <summary>Už bola táto ponuka odoslaná mimo adminu?</summary>
          <div className="offer-external-sent-content">
            <p>Použite iba po kontrole odoslanej pošty alebo po potvrdení zákazníka. Táto voľba nič neposiela; iba opraví evidenciu.</p>
            <form action={confirmPreparedPriceOfferSentExternallyAction} className="admin-pending-form">
              <input type="hidden" name="_csrf" value={csrfToken} />
              <input type="hidden" name="id" value={offer.id} />
              <label>Dátum odoslania<input name="sentOn" type="date" max={today} defaultValue={today} required /></label>
              <label>Spôsob overenia
                <select name="externalEvidence" required defaultValue="">
                  <option value="" disabled>Vyberte dôkaz</option>
                  <option value="sent_folder_verified">Nájdené v odoslanej pošte</option>
                  <option value="recipient_confirmed">Zákazník potvrdil prijatie</option>
                  <option value="provider_confirmed">Poskytovateľ pošty potvrdil odoslanie</option>
                </select>
              </label>
              <label className="admin-check-label"><input type="checkbox" name="confirmedExternalSent" value="yes" required /> Skontroloval/a som správnu ponuku aj adresáta. Ponuka sa nemá posielať znova.</label>
              <button className="admin-secondary-button" type="submit">Zaevidovať už odoslanú ponuku</button>
            </form>
          </div>
        </details>
      ) : null}
      {query.send && offer.status === 'PRIPRAVENA' ? (
        <section className="admin-card">
          <h2>Odoslanie zákazníkovi</h2>
          <p>Skontrolujte presnú uloženú verziu ponuky. Server túto kontrolu zopakuje tesne pred odoslaním.</p>
          <div className={`offer-preflight ${preflight.blockers.length ? 'has-blockers' : 'is-ready'}`}>
            <strong>{preflight.blockers.length ? 'Ponuku zatiaľ nemožno odoslať' : 'Automatická kontrola prešla'}</strong>
            {preflight.blockers.length ? <ul>{preflight.blockers.map((item) => <li key={item.code}>{item.message}</li>)}</ul> : <p>Cena, platnosť, kontakt, doprava a uložené súčty sú konzistentné.</p>}
            {preflight.warnings.length ? <div className="offer-preflight-warnings"><span>Pred odoslaním si všimnite:</span><ul>{preflight.warnings.map((item) => <li key={item.code}>{item.message}</li>)}</ul></div> : null}
          </div>
          <div className="price-offer-email-preview">
            <span>Predmet</span><strong>{offer.emailSubject}</strong>
            <span>Sprievodný list</span><p>{offer.emailBody}</p>
          </div>
          <details className="offer-full-email-preview"><summary>Zobraziť celý text, ktorý dostane zákazník</summary><pre>{fullEmailText}</pre></details>
          <p className="admin-muted-note">Súkromný náhodný odkaz sa bezpečne vytvorí až po potvrdení odoslania a nahradí označený text v náhľade.</p>
          {!preflight.blockers.length ? <form
            action={sendPriceOfferAction}
            className="admin-pending-form admin-send-offer-form"
          >
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="approvalFingerprint" value={approvalFingerprint} />
            <label className="admin-check-label"><input type="checkbox" name="confirmedPreflight" value="yes" required /> Skontroloval/a som PDF, adresáta a celý text emailu. Schvaľujem túto konkrétnu verziu na odoslanie.</label>
            <PendingOfferButton
              idleText="Odoslať zákazníkovi"
              pendingText="Generujem PDF a odosielam cenovú ponuku zákazníkovi. Môže to trvať niekoľko sekúnd..."
            />
          </form> : <a className="admin-secondary-link" href={`/admin/ponuky/${offer.id}`}>Vrátiť sa a opraviť ponuku</a>}
        </section>
      ) : null}

      {pendingCustomerResponse && offer.customerResponse ? <section className="admin-card offer-customer-response-card" aria-labelledby="customer-response-title">
        <div className="admin-heading"><div><p>Čaká na kontrolu človekom</p><h2 id="customer-response-title">Vyjadrenie zákazníka</h2></div></div>
        <div className="admin-alert is-success">
          <strong>{customerResponseLabels[offer.customerResponse]}</strong>
          {offer.customerResponse === 'DEFERRED' ? <p>Navrhnutý ďalší kontakt: {offer.customerRequestedFollowUpAt ? dateSk(offer.customerRequestedFollowUpAt) : 'neuvedený'}</p> : null}
          {offer.customerResponse === 'DECLINED' ? <p>Dôvod: {customerDeclineReasonLabels[offer.customerResponseReasonCode || ''] || 'neuvedený'}</p> : null}
        </div>
        <p>Vyjadrenie samo nič nezmenilo. Pred zaevidovaním skontrolujte ponuku a podľa potreby kontaktujte zákazníka.</p>
        <div className="offer-customer-response-actions">
          <form action={resolvePriceOfferCustomerResponseAction} className="admin-pending-form">
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="responseRevision" value={offer.customerResponseRevision} />
            <input type="hidden" name="resolution" value="apply" />
            {offer.customerResponse === 'DEFERRED' ? <label>Dátum ďalšieho kontaktu<input name="requestedFollowUpAt" type="date" defaultValue={offer.customerRequestedFollowUpAt || ''} required /></label> : null}
            <label className="admin-check-label"><input type="checkbox" name="confirmedCustomerResponse" value="yes" required /> Odpoveď aj aktuálny stav ponuky som skontroloval/a.</label>
            <button className="admin-primary-button" type="submit">Zaevidovať po kontrole</button>
          </form>
          <form action={resolvePriceOfferCustomerResponseAction} className="admin-pending-form">
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="responseRevision" value={offer.customerResponseRevision} />
            <input type="hidden" name="resolution" value="dismiss" />
            <label>Prečo odpoveď nemožno použiť<textarea name="dismissReason" minLength={3} maxLength={500} required /></label>
            <label className="admin-check-label"><input type="checkbox" name="confirmedCustomerResponse" value="yes" required /> Potvrdzujem, že stav ponuky sa nemá meniť.</label>
            <button className="admin-secondary-button" type="submit">Označiť ako neplatnú</button>
          </form>
        </div>
      </section> : null}

      {offer.status === 'ODOSLANA' || offer.status === 'ODLOZENA' ? <section id="vysledok-ponuky" className="admin-card offer-outcome-card">
        <div className="admin-heading"><div><p>Obchodný výsledok</p><h2>Čo sa stalo s ponukou?</h2></div></div>
        {offer.status === 'ODLOZENA' ? <div className="admin-alert"><strong>Odložená do {offer.nextFollowUpAt || 'neurčeného dátumu'}</strong><p>{offer.outcomeReason}</p></div> : <p>Výsledok zaevidujte jedným rozhodnutím. Pri odložení asistent ponuku vráti do fronty v určený deň.</p>}
        <div className="offer-outcome-grid">
          <form action={updatePriceOfferStatusAction} className="offer-outcome-option is-success">
            <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="status" value="PRIJATA" />
            <strong>Ponuka prešla</strong><span>Zákazník ju prijal a zákazka pokračuje.</span><label>Zdroj potvrdenia<select name="evidenceCode" required defaultValue=""><option value="" disabled>Vyberte dôkaz</option><option value="customer_email">Email zákazníka</option><option value="customer_phone">Telefonické potvrdenie</option><option value="signed_order">Podpísaná objednávka</option><option value="in_person">Osobné potvrdenie</option><option value="other_verified">Iný overený dôkaz</option></select></label><label className="admin-check-label"><input type="checkbox" name="confirmOutcome" value="yes" required /> Prijatie som overil(a).</label><button type="submit">Označiť ako prijatú</button>
          </form>
          {offer.status === 'ODOSLANA' ? <form action={updatePriceOfferStatusAction} className="offer-outcome-option is-warning">
            <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="status" value="ODLOZENA" />
            <strong>Odložiť na neskôr</strong><label>Dôvod<textarea name="reason" minLength={3} maxLength={500} required /></label><label>Ozvať sa znovu<input name="nextFollowUpAt" type="date" required /></label><label>Zdroj dohody<select name="evidenceCode" required defaultValue=""><option value="" disabled>Vyberte dôkaz</option><option value="customer_email">Email zákazníka</option><option value="customer_phone">Telefonický rozhovor</option><option value="signed_order">Písomná dohoda</option><option value="in_person">Osobná dohoda</option><option value="other_verified">Iný overený dôkaz</option></select></label><label className="admin-check-label"><input type="checkbox" name="confirmOutcome" value="yes" required /> Odloženie som overil(a).</label><button type="submit">Uložiť odloženie</button>
          </form> : <form action={updatePriceOfferStatusAction} className="offer-outcome-option">
            <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="status" value="ODOSLANA" />
            <strong>Vrátiť medzi aktívne</strong><span>Zákazník je opäť pripravený rozhodovať.</span><button type="submit">Aktivovať ponuku</button>
          </form>}
          <form action={updatePriceOfferStatusAction} className="offer-outcome-option is-danger">
            <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="status" value="NEUSPESNA" />
            <strong>Ponuka neprešla</strong><label>Dôvod<textarea name="reason" minLength={3} maxLength={500} required /></label><label>Zdroj výsledku<select name="evidenceCode" required defaultValue=""><option value="" disabled>Vyberte dôkaz</option><option value="customer_email">Email zákazníka</option><option value="customer_phone">Telefonický rozhovor</option><option value="signed_order">Písomné vyjadrenie</option><option value="in_person">Osobné vyjadrenie</option><option value="other_verified">Iný overený dôkaz</option></select></label><label className="admin-check-label"><input type="checkbox" name="confirmOutcome" value="yes" required /> Výsledok som overil(a).</label><button type="submit">Uzavrieť ako neúspešnú</button>
          </form>
        </div>
      </section> : null}

      <section className="admin-stat-grid">
        <article><span>m2</span><strong>{offer.areaM2}</strong></article>
        <article><span>Bez DPH</span><strong>{euro(offer.totalWithoutVat)}</strong></article>
        <article className="is-highlight"><span>S DPH</span><strong>{euro(offer.totalWithVat)}</strong></article>
        <article className={isExpired(offer.validUntil) ? 'is-expired' : ''}><span>Platná do</span><strong>{dateSk(offer.validUntil)}</strong></article>
      </section>

      {offer.status === 'PRIPRAVENA' ? <form
        action={savePriceOfferAction}
        className="admin-pending-form"
      >
        <input type="hidden" name="_csrf" value={csrfToken} />
        <PriceOfferForm jobs={jobs.map(toPriceOfferJobOption)} settings={settings} offer={offer} />
      </form> : <section className="admin-card">
        <h2>Odoslaná verzia je uzamknutá</h2>
        <p>Obsah odoslanej alebo prijatej ponuky sa už nemení, aby PDF, email a obchodná história zostali zhodné. Ak treba cenu alebo rozsah upraviť, vytvorte novú cenovú ponuku.</p>
      </section>}
    </main>
  );
}
