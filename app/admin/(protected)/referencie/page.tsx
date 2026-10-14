import { getTestimonial, listBlockedReviewJobs, listEligibleReviewJobs, listReviewRequests, listTestimonialAdminHistory, listTestimonials, listTestimonialsPage } from '@/src/server/db';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import type { TestimonialStatus } from '@/src/server/types';
import { testimonialPublicContentHash } from '@/src/server/testimonial-policy';
import { createTestimonialAction, updateTestimonialAction, updateTestimonialStatusAction } from './actions';
import {
  adminTestimonialConsentInstruction,
  parseAdminTestimonialConsentEvidence,
  publicTestimonialConsentVersion,
  testimonialConsentEvidenceSources,
} from '@/src/lib/testimonial-consent';
import { getReviewRequestSettings } from '@/src/server/review-request-settings';
import ReviewWorkspace from './review-workspace';
import './reviews-admin.css';

const statusLabels: Record<TestimonialStatus, string> = {
  draft: 'rozpracovaná',
  approved: 'zverejnená na webe',
  hidden: 'skrytá',
};

const sourceLabels = {
  admin: 'vložené adminom',
  public: 'poslané zákazníkom',
  google: 'Google',
  phone: 'telefón',
  whatsapp: 'WhatsApp',
  email: 'e-mail',
  personal: 'osobne',
} as const;

export default async function TestimonialsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const statusFilter = ['draft', 'approved', 'hidden'].includes(query.status || '') ? query.status as TestimonialStatus : undefined;
  const requestedPage = Number(query.page);
  const [pageData, admin, eligibleReviewJobs, blockedReviewJobs, reviewRequests, allTestimonials, reviewSettings] = await Promise.all([
    listTestimonialsPage({ page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, pageSize: 50, status: statusFilter }),
    requireAdminUser(),
    listEligibleReviewJobs(),
    listBlockedReviewJobs(),
    listReviewRequests(),
    listTestimonials(),
    getReviewRequestSettings(),
  ]);
  const selectedInPage = pageData.records.find((item) => item.id === query.edit);
  const selected = selectedInPage ?? (query.edit ? await getTestimonial(query.edit) : undefined);
  const selectedOutsidePage = Boolean(selected && !selectedInPage);
  const testimonials = selectedOutsidePage && selected
    ? [selected, ...pageData.records]
    : pageData.records;
  const consentHistory = selected ? await listTestimonialAdminHistory(selected.id) : [];
  const csrfToken = csrfTokenForEmail(admin.email);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (statusFilter) params.set('status', statusFilter);
    const search = params.toString();
    return search ? `/admin/referencie?${search}` : '/admin/referencie';
  };
  const editHref = (id?: string) => {
    const params = new URLSearchParams();
    if (id) params.set('edit', id);
    if (pageData.page > 1) params.set('page', String(pageData.page));
    if (statusFilter) params.set('status', statusFilter);
    const search = params.toString();
    return search ? `/admin/referencie?${search}` : '/admin/referencie';
  };

  return (
    <main className="admin-page">
      <ReviewWorkspace
        eligible={eligibleReviewJobs}
        blocked={blockedReviewJobs}
        requests={reviewRequests}
        testimonials={allTestimonials}
        settings={reviewSettings}
        csrfToken={csrfToken}
        role={admin.role}
        notice={query.notice}
      />
      {query.ulozene === '1' ? <p role="status" aria-live="polite">Zmeny referencie boli uložené.</p> : null}
      {query.chyba ? (
        <p role="alert" aria-live="assertive">
          {query.chyba === 'udaje' ? 'Skontrolujte vyplnené údaje a skúste uloženie znova.'
            : query.chyba === 'nenajdene' ? 'Referenciu sa nepodarilo nájsť. Zoznam bol obnovený.'
          : query.chyba === 'suhlas' ? 'Referenciu nemožno schváliť bez presného znenia súhlasu zákazníka a jeho zdroja a dátumu. Nič sa neuložilo.'
                : query.chyba === 'schvalenie' ? 'Referenciu z automatickej žiadosti možno zverejniť iba cez kontrolu a schválenie v pracovnom priestore vyššie.'
                  : 'Požiadavku sa nepodarilo spracovať. Zoznam bol obnovený.'}
        </p>
      ) : null}

      <section className="admin-card" aria-labelledby="testimonials-list-title">
        <h2 id="testimonials-list-title">Existujúce referencie</h2>
        <p>Rozpracované referencie sú navrchu. Stav „zverejnená na webe“ zobrazí referenciu verejne a môže ho nastaviť iba superadmin po overení súhlasu zákazníka.</p>
        {selectedOutsidePage ? <p role="status">Otvorená referencia je mimo aktuálnej strany alebo zvoleného filtra.</p> : null}
        <form className="admin-filter-bar" method="get" action="/admin/referencie">
          <label>Stav referencie<select name="status" defaultValue={statusFilter ?? ''}><option value="">Všetky stavy</option><option value="draft">Rozpracované</option><option value="approved">Zverejnené na webe</option><option value="hidden">Skryté</option></select></label>
          <button type="submit">Filtrovať</button>
        </form>
        <p aria-live="polite">Zobrazené {pageData.total ? ((pageData.page - 1) * pageData.pageSize) + 1 : 0}–{Math.min(pageData.page * pageData.pageSize, pageData.total)} z {pageData.total} referencií · strana {pageData.page} z {pageData.totalPages}</p>
        {testimonials.length ? testimonials.map((item) => {
          const editing = selected?.id === item.id;
          const parsedConsentEvidence = parseAdminTestimonialConsentEvidence(item.consentEvidence || '', testimonialPublicContentHash(item.customerName, item.rating, item.text));
          const freshPublicConsent = item.consentVersion === publicTestimonialConsentVersion;
          return (
            <article className="admin-card" key={item.id} aria-labelledby={`testimonial-${item.id}`}>
              <div className="admin-heading">
                <div>
                  <p>{statusLabels[item.status]}</p>
                  <h3 id={`testimonial-${item.id}`}>{item.customerName}</h3>
                  <p>{item.location || 'Lokalita neuvedená'} · {item.rating}/5 · {sourceLabels[item.source || 'admin']}</p>
                  <p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(item.createdAt))}</time></p>
                </div>
                <div className="admin-action-row">
                  <a className="admin-secondary-link" href={editHref(editing ? undefined : item.id)}>
                    {editing ? 'Zavrieť úpravu' : 'Upraviť'}
                  </a>
                  {item.status !== 'hidden' ? (
                    <form action={updateTestimonialStatusAction}>
                      <input type="hidden" name="_csrf" value={csrfToken} />
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="status" value="hidden" />
                      <button type="submit">Skryť</button>
                    </form>
                  ) : (
                    <form action={updateTestimonialStatusAction}>
                      <input type="hidden" name="_csrf" value={csrfToken} />
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="status" value="draft" />
                      <button type="submit">Vrátiť do konceptov</button>
                    </form>
                  )}
                </div>
              </div>
              {!editing ? <p>{item.text}</p> : null}
              {editing ? (
                <form className="admin-quote-form" action={updateTestimonialAction}>
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <input type="hidden" name="id" value={item.id} />
                  <label>Meno alebo iniciály<input name="customerName" defaultValue={item.customerName} minLength={2} maxLength={120} required /></label>
                  <label>Lokalita<input name="location" defaultValue={item.location || ''} maxLength={120} /></label>
                  <label>Typ objektu<input name="objectType" defaultValue={item.objectType || ''} maxLength={120} /></label>
                  <label>Dátum realizácie<input name="realizationDate" defaultValue={item.realizationDate || ''} maxLength={40} /></label>
                  <label>E-mail zákazníka (neverejný)<input name="customerEmail" type="email" defaultValue={item.customerEmail || ''} maxLength={160} /></label>
                  <label>Hodnotenie<select name="rating" defaultValue={String(item.rating)} required>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
                  <label>Stav<select name="status" defaultValue={item.status === 'approved' ? 'draft' : item.status} required><option value="draft">rozpracovaná</option>{admin.role === 'SUPER_ADMIN' ? <option value="approved">zverejnená na webe ihneď po uložení</option> : null}<option value="hidden">skrytá</option></select></label>
                  <label>Zdroj referencie<select name="source" defaultValue={item.source || 'admin'} required><option value="admin">Vložené adminom</option><option value="public">Poslané zákazníkom</option><option value="google">Google</option><option value="phone">Telefón</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="personal">Osobne</option></select></label>
                  <label className="admin-form-wide">Text referencie<textarea name="text" defaultValue={item.text} maxLength={1200} rows={5} required /></label>
                  <label className="admin-form-wide">Interná poznámka (neverejná)<textarea name="internalNote" defaultValue={item.internalNote || ''} maxLength={2000} rows={3} /></label>
                  <label className="admin-form-wide">Fotografia (URL)<input name="photoUrl" defaultValue={item.photoUrl || ''} maxLength={2048} /></label>
                  <label className="admin-checkbox admin-form-wide"><input name="consentPublication" type="checkbox" /> Po úprave mám znovu doložený súhlas zákazníka s presným znením tejto referencie.</label>
                  <label className="admin-form-wide">Presné znenie súhlasu<textarea name="consentWording" maxLength={2000} rows={4} placeholder="Zadajte presné celé znenie nového súhlasu. Pole sa zámerne nepredvyplní." /></label>
                  <label>Zdroj nového súhlasu<select name="consentSource" defaultValue=""><option value="">Vyberte zdroj</option>{testimonialConsentEvidenceSources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
                  <label>Dátum získania nového súhlasu<input name="consentDate" type="date" /></label>
                  {item.status === 'approved' ? <p className="admin-form-wide" role="note">Po uložení úpravy sa referencia stiahne z verejného webu. {admin.role === 'SUPER_ADMIN' ? 'Ak ju chcete po kontrole nového znenia znovu zverejniť, výslovne zvoľte stav „zverejnená na webe“ a doložte nový súhlas.' : 'Znovu ju môže zverejniť iba superadmin po kontrole nového znenia a súhlasu.'}</p> : null}
                  <p className="admin-form-wide">{adminTestimonialConsentInstruction} Dôkaz je kryptograficky naviazaný na meno, hodnotenie a text, ktoré sa majú zverejniť. Presné znenie sa nepublikuje ani nepridáva do auditného logu. {parsedConsentEvidence ? `Predchádzajúci záznam súhlasu: ${parsedConsentEvidence.source}, ${parsedConsentEvidence.date}.` : freshPublicConsent ? 'Predchádzajúci súhlas z webového formulára nie je po tejto zmene automaticky potvrdením upraveného textu.' : 'Predchádzajúci dôkaz súhlasu nie je dostupný v novom formáte.'} {item.consentCapturedAt ? `Zaznamenané: ${new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.consentCapturedAt))}.` : ''}{item.consentRevokedAt ? ' Predchádzajúci súhlas bol odvolaný.' : ''}</p>
                  <div className="admin-action-row admin-form-wide"><button className="admin-primary-button" type="submit">Uložiť zmeny</button><a className="admin-secondary-link" href={editHref()}>Zrušiť</a></div>
                </form>
              ) : item.customerEmail ? <p><small>E-mail zákazníka (neverejný): {item.customerEmail}</small></p> : null}
              {editing ? <details className="admin-testimonial-history">
                <summary>História úprav a súhlasov ({consentHistory.length})</summary>
                {!consentHistory.length ? <p>Zatiaľ nie sú uložené predchádzajúce zmeny ani záznamy súhlasov.</p> : <ol>
                  {consentHistory.map((entry) => <li key={`${entry.source}-${entry.id}`}>
                    <p><strong>{entry.source === 'consent'
                      ? entry.event === 'superseded' ? 'Predchádzajúci súhlas nahradený' : entry.event === 'granted' ? 'Súhlas zaznamenaný' : entry.event === 'revoked' ? 'Súhlas odvolaný' : 'Zmena bez nového súhlasu'
                      : entry.event === 'testimonial_created' ? 'Referencia pridaná' : entry.event === 'testimonial_status_changed' ? 'Zmena stavu referencie' : 'Referencia upravená'}</strong>
                      {' · '}<time dateTime={entry.createdAt}>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}</time>
                      {' · '}{entry.actorEmail}</p>
                    {entry.source === 'audit' && entry.event === 'testimonial_status_changed' && entry.changes ? <p>Stav: {statusLabels[String(entry.changes.previous) as TestimonialStatus] || 'neznámy'} → {statusLabels[String(entry.changes.next) as TestimonialStatus] || 'neznámy'}</p> : null}
                    {entry.snapshot ? <details>
                      <summary>Verzia obsahu a dôkaz súhlasu</summary>
                      <p><strong>{entry.snapshot.customerName}</strong> · {entry.snapshot.rating}/5</p>
                      <blockquote>{entry.snapshot.text}</blockquote>
                      <p>Súhlas so zverejnením: {entry.snapshot.consentPublication ? 'áno' : 'nie'} · verzia: {entry.snapshot.consentVersion || 'neuvedená'}</p>
                      {entry.snapshot.consentEvidence ? <p><strong>Presné znenie / dôkaz:</strong><br />{entry.snapshot.consentEvidence}</p> : <p>Textový dôkaz súhlasu nie je uložený.</p>}
                      {entry.snapshot.consentCapturedAt ? <p>Zaznamenané: {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.snapshot.consentCapturedAt))}</p> : null}
                      {entry.snapshot.consentRevokedAt ? <p>Súhlas odvolaný: {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.snapshot.consentRevokedAt))}</p> : null}
                      <p>Kontrolný odtlačok obsahu: <code>{entry.snapshot.publicContentHash}</code></p>
                    </details> : null}
                  </li>)}
                </ol>}
              </details> : null}
            </article>
          );
        }) : <p>{statusFilter ? 'V tomto stave zatiaľ nie sú žiadne referencie.' : 'Zatiaľ nie sú pridané žiadne referencie.'}</p>}
        {pageData.totalPages > 1 ? <nav className="admin-pagination" aria-label="Stránkovanie referencií">
          {pageData.page > 1 ? <a href={pageHref(pageData.page - 1)}>Predchádzajúce</a> : null}
          <span>Strana {pageData.page} z {pageData.totalPages}</span>
          {pageData.page < pageData.totalPages ? <a href={pageHref(pageData.page + 1)}>Ďalšie</a> : null}
        </nav> : null}
      </section>

      <section className="admin-card" aria-labelledby="testimonial-create-title">
        <h2 id="testimonial-create-title">Pridať referenciu</h2>
        <p>{admin.role === 'SUPER_ADMIN' ? 'Novú referenciu môžete uložiť ako rozpracovanú alebo ju po doložení presného súhlasu výslovne zverejniť na webe.' : 'Novú referenciu môžete uložiť iba ako rozpracovanú alebo skrytú. Zverejnenie na webe schvaľuje superadmin po overení súhlasu zákazníka.'}</p>
        <form className="admin-quote-form" action={createTestimonialAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>Meno alebo iniciály<input name="customerName" placeholder="napr. Ján P." maxLength={120} required /></label>
          <label>Lokalita<input name="location" placeholder="napr. Poprad / Prešovský kraj" maxLength={120} /></label>
          <label>E-mail zákazníka (neverejný)<input name="customerEmail" type="email" placeholder="voliteľné" maxLength={160} /></label>
          <label>Hodnotenie<select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} hviezdičok</option>)}</select></label>
          <label>Stav<select name="status" defaultValue="draft"><option value="draft">rozpracovaná</option>{admin.role === 'SUPER_ADMIN' ? <option value="approved">zverejnená na webe ihneď po uložení</option> : null}<option value="hidden">skrytá</option></select></label>
          <label className="admin-form-wide">Text referencie<textarea name="text" rows={4} maxLength={1200} placeholder="Krátky, vecný text referencie..." required /></label>
          <label className="admin-checkbox admin-form-wide"><input name="consentPublication" type="checkbox" /> Mám doložený súhlas zákazníka so zverejnením referencie.</label>
          <label className="admin-form-wide">Presné znenie, ktoré zákazník odsúhlasil<textarea name="consentWording" maxLength={2000} rows={4} placeholder="Vložte celé znenie súhlasu, nie jeho zhrnutie." /></label>
          <label>Zdroj doloženého súhlasu<select name="consentSource" defaultValue=""><option value="">Vyberte zdroj</option>{testimonialConsentEvidenceSources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
          <label>Dátum získania súhlasu<input name="consentDate" type="date" /></label>
          <p className="admin-form-wide">{adminTestimonialConsentInstruction} Presné znenie sa nepublikuje ani nepridáva do auditného logu.</p>
          <button className="admin-primary-button" type="submit">Uložiť referenciu</button>
        </form>
      </section>
    </main>
  );
}
