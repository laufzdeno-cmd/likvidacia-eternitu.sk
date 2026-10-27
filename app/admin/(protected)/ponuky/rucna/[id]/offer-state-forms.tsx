'use client';

import { useActionState } from 'react';
import type { ManualPriceOffer } from '@/src/server/job-workspace-types';
import { acceptManualOfferAction, recordManualOutcomeAction, verifyManualOfferSentAction, type ManualOfferActionState } from '../actions';
import styles from '../manual-offer.module.css';

const initial: ManualOfferActionState = { ok: false, message: '' };
export default function ManualOfferStateForms({ offer, csrfToken, owners, defaultOwner }: { offer: ManualPriceOffer; csrfToken: string; owners: Array<{ name: string; email: string }>; defaultOwner: string }) {
  const [sent, sentAction, sending] = useActionState(verifyManualOfferSentAction, initial);
  const [accepted, acceptAction, accepting] = useActionState(acceptManualOfferAction, initial);
  const [outcome, outcomeAction, savingOutcome] = useActionState(recordManualOutcomeAction, initial);
  return <div className={styles.grid}>
    {offer.status === 'DRAFT' ? <form className={styles.panel} action={sentAction}>
      <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="revision" value={offer.revision} />
      <p className={styles.eyebrow}>Overiť pôvodné odoslanie</p><h2>Jarka už PDF odoslala</h2><label>Skutočný deň odoslania<input name="sentOn" type="date" required /></label><label>Dôkaz odoslania<textarea name="evidence" required minLength={3} maxLength={1000} rows={3} placeholder="Napríklad ID správy z Gmailu a potvrdenie adresáta; interná poznámka k overeniu." /></label><label className={styles.check}><input name="confirmSent" type="checkbox" required /><span>Overil/a som, že tento originál zákazník skutočne dostal.</span></label><button disabled={sending || sent.ok}>{sending ? 'Zapisujem…' : 'Označiť ako odoslanú'}</button><p>Nič sa znovu neodošle.</p>{sent.message ? <p role="status">{sent.message}</p> : null}
    </form> : null}
    {offer.status === 'SENT_VERIFIED' || offer.status === 'DEFERRED' ? <form className={styles.panel} action={acceptAction}>
      <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="revision" value={offer.revision} />
      <p className={styles.eyebrow}>Odovzdať na realizáciu</p><h2>Zákazník ponuku prijal</h2><label>Deň prijatia<input name="acceptedOn" type="date" required /></label><label>Zodpovedná osoba za zákazku<select name="responsibleEmail" required defaultValue={defaultOwner}><option value="">Vyberte Slávku / zodpovednú osobu</option>{owners.map(owner => <option key={owner.email} value={owner.email}>{owner.name || owner.email} · {owner.email}</option>)}</select></label><label className={styles.check}><input type="checkbox" name="confirmAccepted" required /><span>Prijatie bolo skutočne potvrdené zákazníkom.</span></label><button disabled={accepting || accepted.ok}>{accepting ? 'Pripravujem kartu…' : 'Potvrdiť a otvoriť zákazku'}</button>{accepted.message ? <p role="status">{accepted.message} {accepted.jobId ? <a href={`/admin/zakazky/${accepted.jobId}`}>Otvoriť kartu zákazky →</a> : null}</p> : null}
    </form> : null}
    {offer.status === 'SENT_VERIFIED' || offer.status === 'DEFERRED' ? <form className={styles.panel} action={outcomeAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={offer.id} /><input type="hidden" name="revision" value={offer.revision} /><h2>Odloženie alebo odmietnutie</h2><label>Výsledok<select name="status"><option value="DEFERRED">Odložená na neskôr</option><option value="REJECTED">Odmietnutá</option></select></label><label>Prečo a čo bude nasledovať<textarea name="reason" required minLength={3} maxLength={5000} rows={3} /></label><button disabled={savingOutcome || outcome.ok}>Uložiť výsledok</button>{outcome.message ? <p role="status">{outcome.message}</p> : null}</form> : null}
  </div>;
}
