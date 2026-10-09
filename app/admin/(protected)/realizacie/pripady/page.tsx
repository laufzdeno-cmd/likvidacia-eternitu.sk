import { redirect } from 'next/navigation';
import { csrfTokenForEmail, requireSuperAdmin } from '@/src/server/auth';
import { listPhotoIntakeJobOptions, listPhotoIntakeRecords, listRealizationCaseDrafts } from '@/src/server/db';
import { saveCaseDraftAction, setCaseDraftPhotoAction, transitionCaseDraftAction, updateCaseDraftPhotoMetadataAction } from './actions';

export default async function RealizationCaseDraftsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireSuperAdmin();
  const params = await searchParams;
  const id = params.id || '';
  const photoDraftOutcome = params.photoDraft;
  const requestedPhotoPage = Number(params.photoPage);
  const photoPage = Number.isInteger(requestedPhotoPage) && requestedPhotoPage > 0 ? requestedPhotoPage : 1;
  const drafts = await listRealizationCaseDrafts();
  const selected = id ? drafts.find((draft) => draft.id === id) : undefined;
  if (id && !selected) redirect('/admin/realizacie/pripady');
  const [photoResult, jobs] = await Promise.all([
    selected?.lifecycle === 'draft' ? listPhotoIntakeRecords({ businessJobId: selected.businessJobId ?? null, approvedOnly: true, page: photoPage, pageSize: 50 }) : Promise.resolve(null),
    listPhotoIntakeJobOptions(),
  ]);
  const attachedIds = new Set(selected?.media.map((media) => media.id) ?? []);
  const csrfToken = csrfTokenForEmail(admin.email);

  return <main className="admin-page">
    <div className="admin-heading"><div><p>Súkromná príprava obsahu</p><h1>Koncepty prípadov</h1></div><a className="admin-secondary-link" href="/admin/realizacie/fotky">Fotky z terénu</a></div>
    {photoDraftOutcome === 'created' ? <p role="status">Vznikol súkromný koncept. Lokalita a typ objektu sú predvyplnené z internej kontroly; doplňte iba informácie, ktoré tím potvrdil.</p> : null}
    {photoDraftOutcome === 'updated' ? <p role="status">Fotografia sa pripojila k existujúcemu súkromnému konceptu. Ručne doplnené údaje zostali zachované.</p> : null}
    {photoDraftOutcome === 'attached-metadata' ? <p role="status">Fotografia sa pripojila k súkromnému konceptu a predvyplnili sa chýbajúce údaje z jej interného popisu. Skontrolujte ich a doplňte potvrdený priebeh práce.</p> : null}
    {photoDraftOutcome === 'metadata' ? <p role="status">Doplnili sa chýbajúce údaje z fotografie. Fotografia už bola pripojená; ostatné údaje konceptu zostali bez zmeny.</p> : null}
    {photoDraftOutcome === 'unchanged' ? <p role="status">Táto fotografia už bola pripojená. Koncept sa nezmenil.</p> : null}
    {photoDraftOutcome === 'existing' ? <p role="status">Táto dokončená zákazka už má odovzdaný alebo zverejnený koncept. Otvorili ste jeho aktuálny stav; automaticky sa nemenil.</p> : null}
    {selected ? <section className="admin-card">
      <h2>Publikačný proces</h2>
      <p>Každý prípad sa zverejňuje samostatne až po redakčnej kontrole. Verejné budú iba schválený text, bezpečne zovšeobecnená obec alebo okres (prípadne bez lokality) a očistené fotografie; osobné údaje zákazníka sa nezobrazujú.</p>
      <p><strong>Aktuálny stav:</strong> {selected.lifecycle === 'draft' ? 'Súkromný koncept' : selected.lifecycle === 'reviewed' ? 'Čaká na schválenie' : selected.lifecycle === 'approved' ? 'Schválený, zatiaľ nezverejnený' : selected.lifecycle === 'published' ? 'Zverejnený' : 'Stiahnutý z webu'}</p>
      {selected.businessJob ? <div className="admin-alert">
        <strong>Interná presná lokalita CRM:</strong> {selected.businessJob.exactLocation || 'V zákazke nie je uvedená'}
        <br /><small>Tento údaj slúži iba administrácii. Na verejný web sa prenesie výhradne samostatne zvolená obec, okres alebo žiadna lokalita.</small>
      </div> : null}
      {selected.lifecycle !== 'draft' ? <div className="admin-case-review-preview">
        <h3>Náhľad uzamknutého obsahu</h3>
        <dl><div><dt>Názov</dt><dd>{selected.title || 'Neuvedený'}</dd></div>
          <div><dt>Približná lokalita</dt><dd>{selected.locality || 'Neuvedená'} · {selected.localityPrecision === 'municipality' ? 'obec' : selected.localityPrecision === 'district' ? 'okres' : 'neurčená presnosť'}</dd></div>
          <div><dt>Typ objektu a materiál</dt><dd>{selected.objectType || 'Neuvedené'} · {selected.materialType || 'Neuvedený'}</dd></div>
          <div><dt>Priebeh práce</dt><dd>{selected.workDescription || 'Neuvedený'}</dd></div>
          <div><dt>Výsledok</dt><dd>{selected.resultDescription || 'Neuvedený'}</dd></div>
          <div><dt>Obdobie a výmera</dt><dd>{selected.workPeriod || 'Neuvedené'} · {selected.areaEstimate ? `${selected.areaEstimate} m²` : 'výmera neuvedená'}</dd></div>
        </dl>
        <h4>Pripojené fotografie ({selected.media.length})</h4>
        {selected.media.length ? <div className="photo-admin-grid">{selected.media.map((photo) => <figure key={photo.id}>
          <img src={`/api/photo-intake/media/${photo.id}`} alt="Očistená fotografia prípadu na redakčnú kontrolu" loading="lazy" />
          <figcaption>{photo.phase === 'before' ? 'Pred prácou' : photo.phase === 'after' ? 'Po práci' : 'Počas práce'} · {photo.publicCaption || photo.locality || 'Bez verejného popisu'}</figcaption>
        </figure>)}</div> : <p>Prípad zatiaľ nemá pripojenú schválenú fotografiu.</p>}
      </div> : null}
      {selected.lifecycle === 'draft' ? <form action={transitionCaseDraftAction}>
        <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="nextLifecycle" value="reviewed" />
        <button type="submit">Odovzdať na redakčné posúdenie</button>
      </form> : null}
      {selected.lifecycle === 'reviewed' ? <>
        <p>Skontrolujte, že text aj fotografie zodpovedajú tejto zákazke a neodhaľujú zákazníka, presnú adresu ani citlivé údaje.</p>
        <form action={transitionCaseDraftAction} className="admin-case-draft-form">
          <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="nextLifecycle" value="approved" />
          <label className="admin-form-wide">Interný podklad a jeho overiteľný zdroj<input name="publicationEvidence" required minLength={4} maxLength={500} placeholder="Napr. súhlas zákazníka v CRM, dátum a odkaz na interný záznam" /></label>
          <label className="admin-form-checkbox"><input type="checkbox" name="rightsConfirmed" required /> <span>Práva na zverejnenie textu a fotografií sú doložené.</span></label>
          <label className="admin-form-checkbox"><input type="checkbox" name="locationConfirmed" required /> <span>Lokalita je bezpečne zovšeobecnená alebo ju z verejného prípadu úplne vynechávame.</span></label>
          <label className="admin-form-wide admin-form-checkbox"><input type="checkbox" name="contentConfirmed" required /> <span>Obsah je pravdivý, neobsahuje osobné údaje a fotografie patria k tejto dokončenej zákazke.</span></label>
          <div className="admin-form-wide"><button type="submit">Schváliť na zverejnenie</button></div>
        </form>
        <form action={transitionCaseDraftAction}>
          <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="nextLifecycle" value="draft" />
          <button type="submit">Vrátiť do konceptu na úpravu</button>
        </form>
      </> : null}
      {selected.lifecycle === 'approved' ? <form action={transitionCaseDraftAction}>
        <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="nextLifecycle" value="published" />
        <button type="submit">Zverejniť schválený prípad</button>
      </form> : null}
      {selected.lifecycle === 'approved' ? <form action={transitionCaseDraftAction}>
        <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="nextLifecycle" value="draft" />
        <button type="submit">Vrátiť do konceptu na úpravu</button>
        <p>Schválenie sa zruší a pred zverejnením bude potrebné nové redakčné posúdenie aj nové potvrdenie.</p>
      </form> : null}
      {selected.lifecycle === 'published' ? <form action={transitionCaseDraftAction}>
        <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="nextLifecycle" value="withdrawn" />
        <button type="submit">Stiahnuť z verejnej stránky</button>
      </form> : null}
    </section> : null}
    <section className="admin-card">
      <h2>{selected ? 'Upraviť koncept' : 'Nový koncept'}</h2>
      <p>Koncept je dostupný iba v administrácii. Uloženie nič nezverejní a nemení stav fotiek. Zapisujte len údaje potvrdené tímom; nevkladajte meno zákazníka, presnú adresu ani interné dokumenty.</p>
      {(!selected || selected.lifecycle === 'draft') ? <form action={async (formData) => { 'use server'; const savedId = await saveCaseDraftAction(formData); redirect(`/admin/realizacie/pripady?id=${savedId}`); }} className="admin-case-draft-form">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="id" value={selected?.id ?? ''} />
        <label className="admin-form-wide">Dokončená CRM zákazka<select name="businessJobId" defaultValue={selected?.businessJobId ?? ''} required={!selected}>
          {!selected ? <option value="">Vyberte zákazku</option> : null}
          {selected && !selected.businessJobId ? <option value="">Starší koncept bez priradenej zákazky</option> : null}
          {selected?.businessJobId && !jobs.some((job) => job.id === selected.businessJobId) ? <option value={selected.businessJobId}>{selected.businessJob ? `${selected.businessJob.demolitionDate} · ${selected.businessJob.district || 'Okres neuvedený'} · existujúce priradenie` : 'Existujúce priradenie zákazky'}</option> : null}
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.demolitionDate} · {job.district || 'Okres neuvedený'}</option>)}
        </select><small>Vyberajte iba podľa dátumu a okresu. Meno a kontakty zákazníka sa tu nezobrazujú.</small></label>
        <label>Názov konceptu<input name="title" defaultValue={selected?.title} maxLength={160} /></label>
        <label>Obec alebo približná lokalita<input name="locality" defaultValue={selected?.locality} maxLength={120} /></label>
        <label>Presnosť lokality<select name="localityPrecision" defaultValue={selected?.localityPrecision ?? 'none'}><option value="none">Bez lokality – nezobrazovať na mape</option><option value="municipality">Obec</option><option value="district">Okres</option></select></label>
        <p className="admin-form-wide">Ak chcete lokalitu úplne vynechať, vymažte aj pole „Obec alebo približná lokalita“. Pri citlivom objekte sa nezverejní názov obce ani mapový bod.</p>
        <label>Typ objektu<input name="objectType" defaultValue={selected?.objectType} maxLength={100} placeholder="Napr. rodinný dom" /></label>
        <label>Materiál<input name="materialType" defaultValue={selected?.materialType} maxLength={100} /></label>
        <label>Obdobie práce (iba potvrdené)<input name="workPeriod" defaultValue={selected?.workPeriod} maxLength={80} placeholder="Napr. 2025" /></label>
        <label>Približná výmera (m²)<input name="areaEstimate" type="number" min="0.01" max="1000000" step="0.01" defaultValue={selected?.areaEstimate} /></label>
        <label className="admin-form-wide">Čo bolo potrebné vyriešiť<textarea name="workDescription" defaultValue={selected?.workDescription} maxLength={3000} rows={4} /></label>
        <label className="admin-form-wide">Priebeh a výsledok práce<textarea name="resultDescription" defaultValue={selected?.resultDescription} maxLength={3000} rows={4} /></label>
        <div className="admin-form-wide"><button type="submit">Uložiť súkromný koncept</button></div>
      </form> : <p>Obsah je po odovzdaní na posúdenie uzamknutý. Ak treba opravu, vráťte prípad do konceptu.</p>}
    </section>
    {selected && selected.lifecycle === 'draft' ? <section className="admin-card">
      <h2>Fotografie prípadu ({selected.media.length} pripojených)</h2>
      <p>Fotky sa pridávajú samostatne a zostávajú súkromné. Možno pripojiť iba interne schválené fotografie z rovnakej CRM zákazky. Pripojené fotky sú vyňaté z automatického mazania; dátum pri každej pomáha správcovi sledovať, ako dlho zostáva uložená. Táto evidencia nič nemaže ani neodpája.</p>
      {selected.media.length ? <div className="photo-admin-grid">{selected.media.map((photo) => <article key={photo.id}>
        <img src={`/api/photo-intake/media/${photo.id}`} alt="Súkromná fotografia pripojená ku konceptu" loading="lazy" />
        <strong>{photo.originalName}</strong><small>{photo.locality || 'Lokalita neuvedená'} · {photo.uploadedAt ? 'nahrané' : 'zaevidované'} {new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(photo.uploadedAt ?? photo.createdAt))}</small>
        <form action={updateCaseDraftPhotoMetadataAction} className="admin-photo-meta-form">
          <input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="mediaId" value={photo.id} />
          <label>Fáza<select name="phase" defaultValue={photo.phase}><option value="before">Pred prácou</option><option value="during">Počas práce</option><option value="after">Po práci</option></select></label>
          <label>Poradie<input name="sortOrder" type="number" min="0" max="999" step="1" defaultValue={photo.sortOrder} required /></label>
          <label>Verejný popis<input name="publicCaption" defaultValue={photo.publicCaption} maxLength={240} placeholder="Napr. Stav strechy pred demontážou" /></label>
          <button type="submit">Uložiť popis fotky</button>
        </form>
        <form action={setCaseDraftPhotoAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="mediaId" value={photo.id} /><input type="hidden" name="attach" value="false" /><button type="submit">Odpojiť fotku</button></form>
      </article>)}</div> : <p>Zatiaľ nie sú pripojené fotografie.</p>}
      <h3>Dostupné fotografie</h3>
      {!photoResult?.records.length ? <p>Na tejto strane nie sú ďalšie interne schválené fotografie.</p> : <div className="photo-admin-grid">{photoResult.records.filter((photo) => !attachedIds.has(photo.id) && photo.businessJobId === selected.businessJobId).map((photo) => <article key={photo.id}>
        <img src={`/api/photo-intake/media/${photo.id}`} alt="Súkromná fotografia na výber" loading="lazy" />
        <strong>{photo.originalName}</strong><small>{photo.locality || 'Lokalita neuvedená'}</small>
        <form action={setCaseDraftPhotoAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="draftId" value={selected.id} /><input type="hidden" name="mediaId" value={photo.id} /><input type="hidden" name="attach" value="true" /><button type="submit">Pripojiť fotku</button></form>
      </article>)}</div>}
      {photoResult?.records.some((photo) => !attachedIds.has(photo.id) && photo.businessJobId === selected.businessJobId) === false ? <p>Na tejto strane nie sú voľné interne schválené fotografie z tejto zákazky.</p> : null}
      {photoResult && photoResult.totalPages > 1 ? <nav className="admin-pagination" aria-label="Stránkovanie schválených fotografií">
        {photoResult.page > 1 ? <a href={`?id=${selected.id}&photoPage=${photoResult.page - 1}`}>Predchádzajúce fotografie</a> : null}
        <span>Strana {photoResult.page} z {photoResult.totalPages} · spolu {photoResult.total}</span>
        {photoResult.page < photoResult.totalPages ? <a href={`?id=${selected.id}&photoPage=${photoResult.page + 1}`}>Ďalšie fotografie</a> : null}
      </nav> : null}
    </section> : selected ? <section className="admin-card"><h2>Fotografie</h2><p>Fotografie sú počas redakčného posúdenia a po schválení uzamknuté spolu s obsahom. Ak treba opravu, najprv vráťte prípad do konceptu.</p></section> : <section className="admin-card"><h2>Fotografie</h2><p>Najprv uložte koncept. Potom k nemu môžete samostatne pripojiť interne schválené súkromné fotky.</p></section>}
    <section className="admin-card"><h2>Uložené koncepty ({drafts.length})</h2>
      {!drafts.length ? <p>Zatiaľ tu nie sú žiadne koncepty.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Názov</th><th>Lokalita</th><th>CRM zákazka</th><th>Fotky</th><th>Najstaršia pripojená fotka</th><th>Posledná úprava</th><th>Stav</th><th></th></tr></thead><tbody>
        {drafts.map((draft) => {
          const oldestPhoto = draft.media.reduce<string | undefined>((oldest, photo) => {
            const receivedAt = photo.uploadedAt ?? photo.createdAt;
            return !oldest || receivedAt < oldest ? receivedAt : oldest;
          }, undefined);
          const lifecycleLabel = draft.lifecycle === 'draft' ? 'Súkromný koncept' : draft.lifecycle === 'reviewed' ? 'Čaká na schválenie' : draft.lifecycle === 'approved' ? 'Schválený – nezverejnený' : draft.lifecycle === 'published' ? 'Zverejnený' : 'Stiahnutý';
          return <tr key={draft.id}><td>{draft.title || 'Nepomenovaný koncept'}</td><td>{draft.locality || 'Neuvedená'}</td><td>{draft.businessJob ? `${draft.businessJob.demolitionDate} · ${draft.businessJob.district || 'Okres neuvedený'}` : 'Starý koncept bez väzby'}</td><td>{draft.media.length}</td><td>{oldestPhoto ? new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short' }).format(new Date(oldestPhoto)) : '—'}</td><td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(draft.updatedAt))}</td><td>{lifecycleLabel}</td><td><a href={`/admin/realizacie/pripady?id=${draft.id}`}>{draft.lifecycle === 'draft' ? 'Upraviť' : 'Otvoriť'}</a></td></tr>;
        })}
      </tbody></table></div>}
    </section>
  </main>;
}
