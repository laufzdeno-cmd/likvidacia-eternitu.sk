import { listRealizations } from '@/src/server/db';
import type { RealizationStatus } from '@/src/server/types';
import { createRealizationAction, updateRealizationStatusAction } from './actions';

const statusLabels: Record<RealizationStatus, string> = {
  draft: 'rozpracovaná',
  published: 'zverejnená',
  hidden: 'skrytá',
};

export default async function RealizationsPage() {
  const realizations = await listRealizations();

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Fotogaléria</p>
          <h1>Realizácie</h1>
        </div>
      </div>

      <section className="admin-card">
        <h2>Pridať realizáciu</h2>
        <p>Verejne sa zobrazia iba realizácie so stavom zverejnená. Používajte len schválené fotky bez súkromných údajov zákazníka.</p>
        <form className="admin-quote-form" action={createRealizationAction}>
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
            Výmera v m²
            <input name="areaEstimate" type="number" step="0.01" placeholder="napr. 180" />
          </label>
          <label>
            Stav
            <select name="status" defaultValue="draft">
              <option value="draft">rozpracovaná</option>
              <option value="published">zverejnená</option>
              <option value="hidden">skrytá</option>
            </select>
          </label>
          <label className="admin-checkbox">
            <input name="featured" type="checkbox" /> Odporúčaná realizácia
          </label>
          <label className="admin-form-wide">
            Popis akcie
            <textarea name="description" rows={4} placeholder="Krátko popíšte rozsah, materiál, priebeh a výsledok..." required />
          </label>
          <label className="admin-form-wide">
            Fotky ASTANA, ideálne 2–3 URL na samostatný riadok
            <textarea
              name="imageUrls"
              rows={4}
              placeholder={'https://.../stabilizacia.webp\nhttps://.../balenie.webp\nhttps://.../odvoz.webp'}
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
                    <small>{realization.materialType || 'materiál neuvedený'}{realization.areaEstimate ? ` · ${realization.areaEstimate} m²` : ''}</small>
                  </td>
                  <td>{realization.imageUrls.length}</td>
                  <td><span className="status-pill">{statusLabels[realization.status]}</span></td>
                  <td>
                    <div className="admin-action-row">
                      {(['published', 'draft', 'hidden'] as RealizationStatus[]).map((status) => (
                        <form key={status} action={updateRealizationStatusAction}>
                          <input type="hidden" name="id" value={realization.id} />
                          <input type="hidden" name="status" value={status} />
                          <button type="submit" disabled={realization.status === status}>
                            {statusLabels[status]}
                          </button>
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
