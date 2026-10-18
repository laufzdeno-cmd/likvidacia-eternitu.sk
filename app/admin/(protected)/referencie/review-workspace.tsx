import type { AdminRole, ReviewEligibleJob, ReviewRequest, Testimonial } from '@/src/server/types';
import type { ReviewRequestSettings } from '@/src/server/review-request-settings';
import { reviewRequestPreview } from '@/src/server/review-request-policy';
import {
  approveAndPublishRequestedTestimonialAction,
  approveRequestedTestimonialAction,
  cancelReviewRequestAction,
  prepareReviewRequestsAction,
  publishRequestedTestimonialAction,
  reopenCancelledReviewRequestAction,
  resolveUnknownReviewRequestDeliveryAction,
  saveReviewRequestSettingsAction,
  sendApprovedReviewRequestsAction,
  sendReviewReminderAction,
  setReviewJobBlockedAction,
} from './request-actions';
import ReviewNotice from './review-notice';

const statusLabels: Record<ReviewRequest['status'], string> = {
  pending_approval: 'Čaká na schválenie odoslania',
  sending: 'Odosiela sa',
  smtp_accepted: 'SMTP server správu prijal',
  delivery_failed: 'Odoslanie zlyhalo',
  delivery_unknown: 'Výsledok odoslania neznámy',
  opened: 'Interakcia s formulárom zaznamenaná',
  submitted: 'Referencia prijatá',
  approved: 'Obsah schválený',
  published: 'Zverejnená',
  cancelled: 'Zrušená',
};

const statusTone: Record<ReviewRequest['status'], string> = {
  pending_approval: 'warning', sending: 'info', smtp_accepted: 'info', delivery_failed: 'danger',
  delivery_unknown: 'warning', opened: 'info', submitted: 'success', approved: 'success',
  published: 'published', cancelled: 'muted',
};

function dateTime(value?: string) {
  return value ? new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function noticeText(notice?: string) {
  if (!notice) return '';
  if (notice === 'prepared') return 'Žiadosť je pripravená. Pred odoslaním ešte skontrolujte náhľad a potvrďte odoslanie.';
  if (notice === 'prepared_bulk') return 'Vybrané žiadosti sú pripravené. E-maily ešte neboli odoslané.';
  if (notice.startsWith('delivery_')) {
    const [, accepted = '0', failed = '0', unknown = '0'] = notice.split('_');
    return `Spracované odoslanie: SMTP server prijal ${accepted}, zlyhané ${failed}, neznámy výsledok ${unknown}. Prijatie SMTP serverom ešte nepotvrdzuje doručenie do schránky.`;
  }
  const labels: Record<string, string> = {
    confirmation_required: 'Bez výslovného potvrdenia sa nič neodoslalo.', bulk_denied: 'Operátor môže naraz spracovať iba jedného zákazníka.',
    batch_limit: 'Výber prekročil nastavený hromadný limit.', not_eligible: 'Niektorá zákazka už nie je vhodná na oslovenie.',
    invalid_selection: 'Výber nebolo možné bezpečne spracovať.', reminder_sent: 'SMTP server prijal jedinú povolenú pripomienku. To ešte nepotvrdzuje doručenie do schránky.',
    reminder_failed: 'SMTP prijatie pripomienky sa nepotvrdilo. Ďalšia automatická pripomienka sa neodošle.',
    reminder_unknown: 'Výsledok jedinej pripomienky je neznámy. Z bezpečnostných dôvodov sa nebude opakovať.',
    reminder_result_stale: 'Výsledok pripomienky sa nepodarilo bezpečne priradiť. Obnovte prehľad; ďalší pokus sa automaticky nevytvorí.',
    reminder_not_due: 'Pripomienka ešte nie je povolená, splatná alebo už bola použitá.', reminder_disabled: 'Pripomienky sú vypnuté.',
    cancelled: 'Žiadosť bola zrušená.', cancellation_stale: 'Žiadosť už nebolo možné zrušiť v aktuálnom stave. Obnovte prehľad.',
    blocked: 'Zákazka bola vylúčená z oslovovania.', unblocked: 'Zákazka sa môže znovu zaradiť medzi vhodné.',
    approved: 'Obsah referencie bol schválený. Zatiaľ nie je verejný.', published: 'Referencia bola samostatne zverejnená.',
    approval_stale: 'Referenciu nebolo možné schváliť v aktuálnom stave. Obnovte prehľad a skontrolujte ju znova.',
    publication_stale: 'Referenciu nebolo možné zverejniť v aktuálnom stave. Obnovte prehľad a skontrolujte ju znova.',
    settings_saved: 'Nastavenia referencií boli uložené.', invalid_settings: 'Skontrolujte texty, limity a povinnú značku {{odkaz}}.',
    invalid_block: 'Pri vylúčení uveďte stručný dôvod.', delivery_resolved: 'Neznámy výsledok bol ručne uzavretý podľa kontroly u poskytovateľa.',
    delivery_resolution_stale: 'Stav sa medzitým zmenil. Obnovte prehľad a skontrolujte ho znova.',
    resolution_confirmation_required: 'Ručné uzavretie vyžaduje výber výsledku aj potvrdenie kontroly u poskytovateľa.',
    reopened: 'Zrušená žiadosť bola obnovená ako nový koncept. Pred odoslaním znovu skontrolujte adresáta aj presný text.',
    reopen_stale: 'Žiadosť nemožno obnoviť. Zákazka alebo jej údaje sa zmenili; obnovte stránku a skontrolujte detail.',
    reopen_confirmation_required: 'Obnovenie vyžaduje potvrdenie novej kontroly adresáta a textu.',
  };
  return labels[notice] || 'Požiadavka bola spracovaná.';
}

export default function ReviewWorkspace({
  eligible,
  blocked,
  requests,
  testimonials,
  settings,
  csrfToken,
  role,
  notice,
}: {
  eligible: ReviewEligibleJob[];
  blocked: ReviewEligibleJob[];
  requests: ReviewRequest[];
  testimonials: Testimonial[];
  settings: ReviewRequestSettings;
  csrfToken: string;
  role: AdminRole;
  notice?: string;
}) {
  const pending = requests.filter((item) => ['pending_approval', 'delivery_failed'].includes(item.status));
  const active = requests.filter((item) => !['pending_approval', 'delivery_failed', 'cancelled'].includes(item.status));
  const cancelled = requests.filter((item) => item.status === 'cancelled');
  const testimonialById = new Map(testimonials.map((item) => [item.id, item]));
  const dueReminders = active.filter((item) => item.reminderAllowed && item.reminderDueAt && item.reminderDueAt <= new Date().toISOString()
    && !item.reminderAttemptedAt && !item.reminderStatus && ['smtp_accepted', 'opened'].includes(item.status));
  const incoming = requests.filter((item) => ['submitted', 'approved', 'published'].includes(item.status));

  return <div className="review-workspace">
    <section className="review-hero" aria-labelledby="review-workspace-title">
      <div><p>Spätná väzba bez ručného prepisovania</p><h1 id="review-workspace-title">Referencie a hodnotenia</h1><span>Vyberte hotovú zákazku, skontrolujte správu a až potom povoľte odoslanie.</span></div>
      <div className="review-pulse" aria-label="Rýchly prehľad">
        <span><strong>{eligible.length}</strong> koho osloviť</span>
        <span><strong>{pending.length}</strong> čaká na potvrdenie</span>
        <span><strong>{dueReminders.length}</strong> pripomienky</span>
        <span><strong>{incoming.filter((item) => item.status === 'submitted').length}</strong> na kontrolu</span>
      </div>
    </section>

    {notice ? <ReviewNotice
      message={noticeText(notice)}
      isError={notice.includes('invalid') || notice.includes('failed') || notice.includes('denied') || notice.includes('stale')}
    /> : null}

    <section className="review-panel" aria-labelledby="eligible-title">
      <div className="review-section-heading"><div><p>Krok 1</p><h2 id="eligible-title">Koho osloviť</h2></div><span>{eligible.length} vhodných zákaziek</span></div>
      <p>Len dokončené reálne zákazky s e-mailom. Testy, archív, problémové a už oslovené zákazky sú vylúčené.</p>
      <form id="prepare-review-form" action={prepareReviewRequestsAction}><input type="hidden" name="_csrf" value={csrfToken} /></form>
        <div className="review-card-grid">
          {eligible.map((job) => <article className="review-customer-card" key={job.id}>
            <label className="review-select"><input form="prepare-review-form" type="checkbox" name="jobId" value={job.id} /> Vybrať</label>
            <h3>{job.customerName}</h3><p>{job.location || 'Lokalita neuvedená'} · {job.objectType || 'Objekt neuvedený'}</p>
            <small>{job.customerEmail} · realizácia {job.realizationDate || 'bez dátumu'}</small>
            <details><summary>Zobraziť presný náhľad správy</summary><pre>{reviewRequestPreview(job, settings.body)}</pre></details>
            <form action={setReviewJobBlockedAction} className="review-inline-form">
              <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={job.id} /><input type="hidden" name="blocked" value="true" />
              <label>Dôvod nevhodnosti<input name="reason" maxLength={500} placeholder="napr. nevyriešená reklamácia" required /></label><button className="review-danger-quiet" type="submit">Vylúčiť</button>
            </form>
          </article>)}
          {!eligible.length ? <p className="review-empty">Momentálne nie je dokončená reálna zákazka s e-mailom, ktorú možno bezpečne osloviť.</p> : null}
        </div>
        {eligible.length ? <div className="review-send-bar">
          {settings.reminderEnabled ? <span>Prípadnú jedinú pripomienku možno výslovne povoliť až pri schválení prvej správy.</span> : <span>Pripomienky sú vypnuté.</span>}
          <button form="prepare-review-form" className="admin-primary-button" type="submit">Pripraviť vybrané žiadosti</button>
          <small>{role === 'SUPER_ADMIN' ? `Hromadný limit: ${settings.batchLimit}` : 'Operátor môže pripraviť jedného zákazníka naraz.'} Nič sa teraz neodošle.</small>
        </div> : null}
    </section>

    <section className="review-panel" aria-labelledby="approval-title">
      <div className="review-section-heading"><div><p>Krok 2</p><h2 id="approval-title">Schváliť odoslanie</h2></div><span>{pending.length} pripravených</span></div>
      <form id="send-review-form" action={sendApprovedReviewRequestsAction}><input type="hidden" name="_csrf" value={csrfToken} /></form>
        <div className="review-request-list">
          {pending.map((item) => <article className="review-request-row" key={item.id}>
            <label className="review-select"><input form="send-review-form" type="checkbox" name="requestId" value={item.id} /> Vybrať</label>
            <div><h3>{item.customerName}</h3><p>{item.customerEmail} · {item.location || 'bez lokality'}</p><small>{statusLabels[item.status]} · verzia {item.revision}</small></div>
            <details><summary>Presná správa pred odoslaním</summary><pre>{reviewRequestPreview(item, item.message)}</pre></details>
            <form action={cancelReviewRequestAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={item.id} /><button className="review-danger-quiet" type="submit">Zrušiť</button></form>
          </article>)}
          {!pending.length ? <p className="review-empty">Žiadna správa nečaká na schválenie.</p> : null}
        </div>
        {pending.length ? <div className="review-send-bar review-send-confirm">
          <label><input form="send-review-form" type="checkbox" name="confirmSend" required /> Skontroloval(a) som adresátov a presné znenie. Schvaľujem reálne odoslanie e-mailov.</label>
          {settings.reminderEnabled ? <label><input form="send-review-form" type="checkbox" name="reminderAllowed" /> Výslovne povoľujem pre vybrané žiadosti najviac jednu automatickú pripomienku po {settings.reminderDays} dňoch.</label> : <span>Automatické pripomienky sú vypnuté.</span>}
          <button form="send-review-form" className="admin-primary-button" type="submit">Schváliť a odoslať vybrané</button>
        </div> : null}
    </section>

    <section className="review-panel" aria-labelledby="progress-title">
      <div className="review-section-heading"><div><p>Priebeh</p><h2 id="progress-title">Stavy žiadostí</h2></div><span>{active.length} aktívnych</span></div>
      <div className="review-status-legend" aria-label="Poradie stavov">{['Čaká na schválenie', 'SMTP server správu prijal', 'Referencia prijatá', 'Obsah schválený', 'Zverejnená'].map((label, index) => <span key={label}><b>{index + 1}</b>{label}</span>)}</div>
      <p>Stav „SMTP server správu prijal“ znamená odovzdanie e-mailovému serveru, nie potvrdené doručenie do schránky zákazníka.</p>
      <div className="review-request-list">
        {active.map((item) => <article className="review-request-row" key={item.id}>
          <span className={`review-status review-status-${statusTone[item.status]}`}>{statusLabels[item.status]}</span>
          <div><h3>{item.customerName}</h3><p>{item.location || 'bez lokality'} · žiadosť {dateTime(item.createdAt)}</p><small>SMTP prijatie {dateTime(item.sentAt)} · interakcia s formulárom {dateTime(item.openedAt)} · referencia prijatá {dateTime(item.submittedAt)}</small></div>
          {item.deliveryReasonCode ? <small>Kód výsledku: {item.deliveryReasonCode}</small> : null}
          {item.reminderStatus ? <small>Jediná pripomienka: {item.reminderStatus === 'smtp_accepted'
            ? 'SMTP server ju prijal'
            : item.reminderStatus === 'delivery_failed' ? 'odoslanie zlyhalo' : item.reminderStatus === 'sending' ? 'spracúva sa' : 'výsledok je neznámy'}{item.reminderDeliveryReasonCode ? ` (${item.reminderDeliveryReasonCode})` : ''}</small> : null}
          {item.status === 'delivery_unknown' ? <form action={resolveUnknownReviewRequestDeliveryAction} className="review-reminder-form">
            <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} />
            <label>Overený výsledok<select name="resolution" required defaultValue=""><option value="" disabled>Vyberte po kontrole</option><option value="smtp_accepted">Poskytovateľ eviduje prijatie správy</option><option value="not_sent">Poskytovateľ správu neeviduje</option></select></label>
            <label><input type="checkbox" name="confirmed" required /> Skontroloval(a) som záznam u e-mailového poskytovateľa</label>
            <button type="submit">Ručne uzavrieť výsledok</button>
          </form> : null}
          {dueReminders.some((due) => due.id === item.id) ? <form action={sendReviewReminderAction} className="review-reminder-form">
            <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} />
            <label><input type="checkbox" name="confirmReminder" required /> Potvrdzujem jedinú pripomienku</label><button type="submit">Odoslať pripomienku</button>
          </form> : null}
        </article>)}
        {!active.length ? <p className="review-empty">Zatiaľ nie sú rozpracované odoslané žiadosti.</p> : null}
      </div>
    </section>

    <section className="review-panel" aria-labelledby="incoming-title">
      <div className="review-section-heading"><div><p>Krok 3</p><h2 id="incoming-title">Kontrola a publikovanie</h2></div><span>{incoming.length} prijatých</span></div>
      <p>Prijatie formulára vytvorí iba koncept. Superadmin ho môže po kontrole schváliť a zverejniť jedným krokom; samostatné manuálne schválenie zostáva dostupné.</p>
      <div className="review-card-grid">
        {incoming.map((request) => {
          const testimonial = request.testimonialId ? testimonialById.get(request.testimonialId) : undefined;
          return <article className="review-customer-card" key={request.id}>
            <span className={`review-status review-status-${statusTone[request.status]}`}>{statusLabels[request.status]}</span>
            <h3>{testimonial?.customerName || request.customerName}</h3>
            {testimonial ? <><p aria-label={`Hodnotenie ${testimonial.rating} z 5`}>{testimonial.rating} / 5</p><blockquote>{testimonial.text}</blockquote></> : <p>Koncept referencie sa nepodarilo načítať.</p>}
            <div className="admin-action-row">
              {testimonial && request.status === 'submitted' && role === 'SUPER_ADMIN' ? <form action={approveAndPublishRequestedTestimonialAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="testimonialId" value={testimonial.id} /><button className="admin-primary-button" type="submit">Schváliť a zverejniť</button></form> : null}
              {testimonial && request.status === 'submitted' ? <form action={approveRequestedTestimonialAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="testimonialId" value={testimonial.id} /><button type="submit">Schváliť obsah bez publikovania</button></form> : null}
              {testimonial && request.status === 'approved' && role === 'SUPER_ADMIN' ? <form action={publishRequestedTestimonialAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="testimonialId" value={testimonial.id} /><button className="admin-primary-button" type="submit">Zverejniť na webe</button></form> : null}
              {testimonial ? <a className="admin-secondary-link" href={`/admin/referencie?edit=${testimonial.id}`}>Otvoriť detail</a> : null}
            </div>
          </article>;
        })}
        {!incoming.length ? <p className="review-empty">Zatiaľ neprišla referencia z osobného odkazu.</p> : null}
      </div>
    </section>

    <details className="review-panel review-collapsible">
      <summary>Zrušené žiadosti ({cancelled.length})</summary>
      <p>Obnovenie vytvorí nový koncept z aktuálnych údajov zákazky. Nič sa neodošle, kým správu znovu neskontrolujete a výslovne neschválite.</p>
      <div className="review-request-list">{cancelled.map((item) => <article className="review-request-row" key={item.id}>
        <div><h3>{item.customerName}</h3><p>{item.location || 'bez lokality'} · zrušené {dateTime(item.updatedAt)}</p><small>Starý odkaz je zneplatnený. Verzia {item.revision}.</small></div>
        <form action={reopenCancelledReviewRequestAction} className="review-reminder-form">
          <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="revision" value={item.revision} />
          {settings.reminderEnabled ? <span>Prípadnú jedinú pripomienku povoľte až pri neskoršom schválení odoslania.</span> : null}
          <label><input type="checkbox" name="confirmed" required /> Skontrolujem nový adresát a presný text pred prípadným odoslaním</label>
          <button type="submit">Obnoviť ako koncept</button>
        </form>
      </article>)}</div>
      {!cancelled.length ? <p className="review-empty">Nie sú tu žiadne zrušené žiadosti.</p> : null}
    </details>

    <details className="review-panel review-collapsible">
      <summary>Vylúčené zákazky ({blocked.length})</summary>
      <div className="review-request-list">{blocked.map((job) => <article className="review-request-row" key={job.id}><div><h3>{job.customerName}</h3><p>{job.blockedReason || 'Dôvod neuvedený'}</p></div><form action={setReviewJobBlockedAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={job.id} /><input type="hidden" name="blocked" value="false" /><button type="submit">Povoliť oslovenie</button></form></article>)}</div>
    </details>

    {role === 'SUPER_ADMIN' ? <details className="review-panel review-collapsible">
      <summary>Superadmin nastavenia</summary>
      <form className="review-settings-form" action={saveReviewRequestSettingsAction}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <label>Predmet e-mailu<input name="subject" defaultValue={settings.subject} minLength={5} maxLength={160} required /></label>
        <label>Text prvej žiadosti<textarea name="body" defaultValue={settings.body} minLength={20} maxLength={4000} rows={8} required /></label>
        <label>Text jedinej pripomienky<textarea name="reminderBody" defaultValue={settings.reminderBody} minLength={20} maxLength={4000} rows={8} required /></label>
        <label>Pripomienka po dňoch<input name="reminderDays" type="number" min={5} max={7} defaultValue={settings.reminderDays} required /></label>
        <label>Maximálny hromadný výber<input name="batchLimit" type="number" min={1} max={50} defaultValue={settings.batchLimit} required /></label>
        <label>Google hodnotenie<input name="googleReviewLink" type="url" defaultValue={settings.googleReviewLink} maxLength={2048} /></label>
        <label className="review-checkbox"><input name="reminderEnabled" type="checkbox" defaultChecked={settings.reminderEnabled} /> Povoliť vopred schválenú jedinú pripomienku</label>
        <p>Použite značky <code>{'{{meno}}'}</code>, <code>{'{{lokalita}}'}</code> a povinnú <code>{'{{odkaz}}'}</code>.</p>
        <button className="admin-primary-button" type="submit">Uložiť nastavenia</button>
      </form>
    </details> : null}
  </div>;
}
