import { listLeadSummaries, listRoofers } from '@/src/server/db';
import { getLeadInsight } from '@/src/server/lead-insights';
import { createRooferAction, importRoofersAction, updateRooferFlagsAction } from './actions';

const regions = [
  'Bratislavský',
  'Trnavský',
  'Trenčiansky',
  'Nitriansky',
  'Žilinský',
  'Banskobystrický',
  'Prešovský',
  'Košický',
];

export default async function RoofersAdminPage() {
  const [roofers, leads] = await Promise.all([listRoofers(), listLeadSummaries()]);
  const wantsRooferLeads = leads.filter((lead) => getLeadInsight(lead, lead.fileCount, lead.quoteCount).tags.includes('potrebuje_strechara'));

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Partneri a zladenie striech</p>
          <h1>Strechári / partneri</h1>
        </div>
        <a className="admin-primary-link" href="/strechari/" target="_blank">Verejná stránka</a>
      </div>

      <section className="admin-stat-grid">
        <article><span>Aktívni partneri</span><strong>{roofers.filter((item) => item.active).length}</strong></article>
        <article><span>Overení partneri</span><strong>{roofers.filter((item) => item.verifiedPartner).length}</strong></article>
        <article><span>V overovaní</span><strong>{roofers.filter((item) => item.inVerification).length}</strong></article>
        <article><span>Dopyty chcú strechára</span><strong>{wantsRooferLeads.length}</strong></article>
      </section>

      <section className="admin-card">
        <h2>Pridať strechára</h2>
        <form action={createRooferAction} className="admin-quote-form">
          <label>
            Názov firmy / meno *
            <input name="name" required />
          </label>
          <label>
            IČO
            <input name="ico" />
          </label>
          <label>
            Kontaktná osoba
            <input name="contactPerson" />
          </label>
          <label>
            Telefón
            <input name="phone" />
          </label>
          <label>
            Email
            <input name="email" type="email" />
          </label>
          <label>
            Web
            <input name="web" placeholder="https://..." />
          </label>
          <label>
            Kraj *
            <select name="region" required defaultValue="">
              <option value="">Vyberte kraj</option>
              {regions.map((region) => <option key={region}>{region}</option>)}
            </select>
          </label>
          <label>
            Okresy pôsobenia
            <input name="districts" placeholder="Poprad, Kežmarok, Prešov" />
          </label>
          <label>
            Špecializácia
            <input name="specialization" placeholder="plechové strechy, rekonštrukcie..." />
          </label>
          <label>
            Hodnotenie
            <input name="rating" type="number" min="0" max="5" step="0.1" defaultValue="0" />
          </label>
          <label>
            Počet hodnotení
            <input name="reviewCount" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Počet sťažností
            <input name="complaintsCount" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Interné skóre partnera
            <input name="internalScore" type="number" min="0" max="100" step="1" defaultValue="0" />
          </label>
          <label className="admin-form-wide">
            Verejná poznámka
            <textarea name="publicNote" rows={3} placeholder="Krátky popis pre verejnú kartu partnera." />
          </label>
          <label className="admin-form-wide">
            Interná poznámka
            <textarea name="internalNote" rows={3} placeholder="Poznámka viditeľná len v adminovi." />
          </label>
          <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked /> Aktívny</label>
          <label className="admin-checkbox"><input name="verifiedPartner" type="checkbox" /> Overený partner</label>
          <label className="admin-checkbox"><input name="inVerification" type="checkbox" defaultChecked /> Partner v overovaní</label>
          <label className="admin-checkbox"><input name="preferredPartner" type="checkbox" /> Preferovaný partner</label>
          <button className="admin-primary-button admin-form-wide" type="submit">Uložiť strechára</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Rýchly import strechárov</h2>
        <p className="admin-muted">
          Vložte jeden riadok na partnera. Formát: meno/firma; kraj; okresy; telefón; email; overený áno/nie; hodnotenie; interná poznámka.
        </p>
        <form action={importRoofersAction} className="admin-quote-form">
          <label className="admin-form-wide">
            Importné riadky
            <textarea
              name="rows"
              rows={7}
              placeholder={'Strecha Poprad s.r.o.; Prešovský; Poprad, Kežmarok; 0900 000 000; info@example.sk; áno; 4.8; preveriť kapacitu pred sezónou'}
            />
          </label>
          <button className="admin-primary-button admin-form-wide" type="submit">Importovať strechárov</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Zoznam strechárov</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Región</th>
                <th>Kontakt</th>
                <th>Hodnotenie</th>
                <th>Stav</th>
                <th>Štatistiky</th>
                <th>Rýchla úprava</th>
              </tr>
            </thead>
            <tbody>
              {roofers.map((roofer) => (
                <tr key={roofer.id}>
                  <td>
                    <strong>{roofer.name}</strong>
                    <br />
                    <small>{roofer.ico || 'IČO neuvedené'} · {roofer.specialization || 'špecializácia neuvedená'}</small>
                  </td>
                  <td>{roofer.region}<br /><small>{roofer.districts.join(', ') || 'okresy neuvedené'}</small></td>
                  <td>
                    {roofer.phone ? <a href={`tel:${roofer.phone}`}>{roofer.phone}</a> : 'telefón neuvedený'}
                    <br />
                    {roofer.email ? <a href={`mailto:${roofer.email}`}>{roofer.email}</a> : <small>email neuvedený</small>}
                  </td>
                  <td>{roofer.rating ? `${roofer.rating.toFixed(1)} / 5` : 'bez hodnotenia'}<br /><small>{roofer.reviewCount} hodnotení · {roofer.complaintsCount} sťažností</small></td>
                  <td>
                    <div className="tag-list">
                      <span>{roofer.active ? 'aktívny' : 'neaktívny'}</span>
                      {roofer.verifiedPartner ? <span>overený</span> : null}
                      {roofer.inVerification ? <span>v overovaní</span> : null}
                      {roofer.preferredPartner ? <span>preferovaný</span> : null}
                    </div>
                  </td>
                  <td>
                    {roofer.contactRevealCount} kontaktov · {roofer.quoteUseClickCount} použití<br />
                    <small>{roofer.referralCount} odporúčaní · {roofer.confirmedJobsCount} výhier · skóre {roofer.internalScore}</small>
                  </td>
                  <td>
                    <form action={updateRooferFlagsAction} className="admin-mini-form">
                      <input type="hidden" name="id" value={roofer.id} />
                      <label><input name="active" type="checkbox" defaultChecked={roofer.active} /> aktívny</label>
                      <label><input name="verifiedPartner" type="checkbox" defaultChecked={roofer.verifiedPartner} /> overený</label>
                      <label><input name="inVerification" type="checkbox" defaultChecked={roofer.inVerification} /> v overovaní</label>
                      <label><input name="preferredPartner" type="checkbox" defaultChecked={roofer.preferredPartner} /> preferovaný</label>
                      <button type="submit">Uložiť</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!roofers.length ? <tr><td colSpan={7}>Zatiaľ nie sú pridaní žiadni strechári. Verejná stránka preto zobrazí bezpečný fallback bez falošných údajov.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Dopyty, kde zákazník chce strechára</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Zákazník</th><th>Lokalita</th><th>Výmera</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {wantsRooferLeads.slice(0, 12).map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.fullName}<br /><small>{lead.phone}</small></td>
                  <td>{lead.city}{lead.district ? `, ${lead.district}` : ''}</td>
                  <td>{lead.areaEstimate} m2</td>
                  <td>{lead.status}</td>
                  <td><a href={`/admin/dopyty/${lead.id}`}>Detail</a></td>
                </tr>
              ))}
              {!wantsRooferLeads.length ? <tr><td colSpan={5}>Aktuálne nie sú dopyty s požiadavkou na odporúčanie strechára.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
