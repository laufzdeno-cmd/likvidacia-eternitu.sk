import { listRealizations } from '@/src/server/db';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import type { RealizationStatus } from '@/src/server/types';
import { createRealizationAction, updateRealizationStatusAction } from './actions';

const statusLabels: Record<RealizationStatus, string> = {
  draft: 'rozpracovaná',
  published: 'zverejnená',
  hidden: 'skrytá',
};

export default async function RealizationsPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const [realizations, admin] = await Promise.all([listRealizations(), requireAdminUser()]);
  const params = await searchParams;
  const csrfToken = csrfTokenForEmail(admin.email);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Fotogaléria</p>
          <h1>Realizácie</h1>
        </div>
        <a className="admin-secondary-link" href="/admin/realizacie/fotky">Súkromné fotky z terénu</a>
      </div>

      <section className="admin-card">
        <h2>Pridať realizáciu</h2>
        {params?.error === 'fotky' ? <p role="alert">Fotky sa neuložili. Použite iba cestu k verejnej fotke na tomto webe, ktorá začína na <code>/assets/</code>.</p> : null}
        {params?.error === 'schvalenie' ? <p role="alert">Pred zverejnením potvrďte oprávnenie použiť fotografie, skontrolovanú približnú lokalitu a zadajte internú evidenciu podkladu.</p> : null}
        <p>Nové realizácie sa ukladajú ako rozpracované. Používajte len schválené fotografie bez súkromných údajov zákazníka; verejné fotky vkladajte ako cestu z webu začínajúcu na <code>/assets/</code>. Pred zverejnením treba potvrdiť práva k fotografiám, skontrolovať približnú lokalitu a zaznamenať interný podklad; existujúce verejné položky zostávajú bez zmeny.</p>
        <form className="admin-quote-form" action={createRealizationAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>
            Názov akcie
            <input name="title" placeholder="napr. Demontáž eternitovej strechy" required />
          </label>
          <label>
            Lokalita
            <input name="location" placeholder="napr. Poprad / Prešovský kraj" />
          </label>
          <label>
            Typ materiálu
            <input name="materialType" placeholder="napr. vlnitý eternit" />
          </label>
          <label>
            Výmera v m2
            <input name="areaEstimate" type="number" step="0.01" placeholder="napr. 180" />
          </label>
          <p className="admin-form-wide">Nová položka sa uloží ako rozpracovaná a nebude verejná.</p>
          <label className="admin-checkbox">
            <input name="featured" type="checkbox" /> Odporúčaná realizácia
          </label>
          <label className="admin-form-wide">
            Popis akcie
            <textarea name="description" rows={4} placeholder="Krátko popíšte rozsah, materiál, priebeh a výsledok..." required />
          </label>
          <label className="admin-form-wide">
            Fotky ASTANA, ideálne 2–3 cesty z webu na samostatný riadok
            <textarea
              name="imageUrls"
              rows={4}
              placeholder={'/assets/azbest/webp/azbest-087.webp\n/assets/azbest/webp/azbest-164.webp'}
            />
          </label>
          <button className="admin-primary-button" type="submit">
            Uložiť realizáciu
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Schvaľovanie a poradie</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Akcia</th>
                <th>Parametre</th>
                <th>Fotky</th>
                <th>Stav</th>
                <th>Akcie</th>
              </tr>
            </thead>
            <tbody>
              {realizations.map((realization) => (
                <tr key={realization.id}>
                  <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(realization.createdAt))}</td>
                  <td>
                    <strong>{realization.title}</strong>
                    <br />
                    <small>{realization.description}</small>
                  </td>
                  <td>
                    {realization.location || 'bez lokality'}
                    <br />
                    <small>{realization.materialType || 'materiál neuvedený'}{realization.areaEstimate ? ` · ${realization.areaEstimate} m2` : ''}</small>
                  </td>
                  <td>{realization.imageUrls.length}</td>
                  <td><span className="status-pill">{statusLabels[realization.status]}</span></td>
                  <td>
                    <div className="admin-action-row">
                      {(['published', 'draft', 'hidden'] as RealizationStatus[]).map((status) => (
                        <form key={status} action={updateRealizationStatusAction}>
                          <input type="hidden" name="_csrf" value={csrfToken} />
                          <input type="hidden" name="id" value={realization.id} />
                          <input type="hidden" name="status" value={status} />
                          {status === 'published' && realization.status !== 'published' ? (
                            <details>
                              <summary>Zverejniť po kontrole</summary>
                              <label><input type="checkbox" name="publicationRightsConfirmed" required /> Potvrdzujem právo použiť zobrazené fotografie.</label>
                              <label><input type="checkbox" name="publicationLocationConfirmed" required /> Overil som obec/okres a odstránenie presnej adresy/GPS.</label>
                              <label>Interná referencia zdroja alebo súhlasu<textarea name="publicationEvidence" minLength={4} maxLength={500} required placeholder="Napr. číslo zákazky alebo názov uloženého dokladu; bez osobných údajov" /></label>
                              <button type="submit">Zverejniť</button>
                            </details>
                          ) : (
                            <button type="submit" disabled={realization.status === status}>{statusLabels[status]}</button>
                          )}
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!realizations.length ? <tr><td colSpan={6}>Zatiaľ nie sú pridané žiadne realizácie.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
