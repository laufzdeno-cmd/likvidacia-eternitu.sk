import { adminEmail } from '@/src/server/auth';
import { getBusinessSettings, getPriceOfferSettings, listLandfillPrices, listWorkers } from '@/src/server/db';
import { priceOfferMaterialLabels } from '../ponuky/constants';
import { euro, landfillLabels, landfills } from '../zakazky/constants';
import { changeAdminPasswordAction, deleteLandfillPriceAction, saveGeneralSettingsAction, saveLandfillPriceAction, savePriceOfferSettingsAction, saveWorkerAction } from './actions';

export default async function SettingsAdminPage({ searchParams }: { searchParams?: Promise<{ heslo?: string }> }) {
  const [workers, prices, settings, offerSettings] = await Promise.all([listWorkers(true), listLandfillPrices(), getBusinessSettings(), getPriceOfferSettings()]);
  const params = await searchParams;
  const passwordMessage =
    params?.heslo === 'ulozene'
      ? 'Heslo bolo zmenené.'
      : params?.heslo === 'nespravne'
        ? 'Aktuálne heslo nesedí.'
        : params?.heslo === 'neplatne'
          ? 'Nové heslo musí mať aspoň 8 znakov a obe hodnoty musia byť rovnaké.'
          : '';

  return (
    <main className="admin-page">
      <div className="admin-heading"><div><p>Konfigurácia</p><h1>Nastavenia</h1></div></div>

      <section className="admin-card">
        <h2>Ceny skládok</h2>
        <form className="admin-filter-bar" action={saveLandfillPriceAction}>
          <label>Rok<input name="year" type="number" defaultValue={new Date().getFullYear()} /></label>
          <label>Skládka<select name="landfill">{landfills.map((item) => <option key={item} value={item}>{landfillLabels[item]}</option>)}</select></label>
          <label>€/tonu<input name="pricePerTon" type="number" step="0.01" /></label>
          <button type="submit">Pridať</button>
        </form>
        <table className="admin-table">
          <thead><tr><th>Rok</th><th>Skládka</th><th>€/tonu</th><th>Upraviť</th><th></th></tr></thead>
          <tbody>{prices.map((price) => (
            <tr key={price.id}>
              <form action={saveLandfillPriceAction}>
                <td><input name="year" type="number" defaultValue={price.year} /></td>
                <td><select name="landfill" defaultValue={price.landfill}>{landfills.map((item) => <option key={item} value={item}>{landfillLabels[item]}</option>)}</select></td>
                <td><input name="pricePerTon" type="number" step="0.01" defaultValue={price.pricePerTon} /></td>
                <td><input type="hidden" name="id" value={price.id} /><button type="submit">Uložiť</button></td>
              </form>
              <td><form action={deleteLandfillPriceAction}><input type="hidden" name="id" value={price.id} /><button type="submit">Zmazať</button></form></td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section className="admin-card">
        <h2>Pracovníci</h2>
        <table className="admin-table">
          <thead><tr><th>Meno</th><th>Sadzba €/m²</th><th>Aktívny</th><th></th></tr></thead>
          <tbody>{workers.map((worker) => (
            <tr key={worker.id}>
              <form action={saveWorkerAction}>
                <td><input name="name" defaultValue={worker.name} /></td>
                <td><input name="ratePerM2" type="number" step="0.01" defaultValue={worker.ratePerM2} /></td>
                <td><input name="active" type="checkbox" defaultChecked={worker.active} /></td>
                <td><input type="hidden" name="id" value={worker.id} /><button type="submit">Uložiť</button></td>
              </form>
            </tr>
          ))}</tbody>
        </table>
        <form className="admin-filter-bar" action={saveWorkerAction}>
          <label>Meno<input name="name" /></label>
          <label>Sadzba<input name="ratePerM2" type="number" step="0.01" /></label>
          <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked /> Aktívny</label>
          <button type="submit">Pridať pracovníka</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Predvolené hodnoty</h2>
        <form className="admin-quote-form" action={saveGeneralSettingsAction}>
          <label>Základná cena za m²<input name="defaultPricePerM2" type="number" step="0.01" defaultValue={settings.defaultPricePerM2} /></label>
          <label className="admin-form-wide">Google review link<input name="googleReviewLink" defaultValue={settings.googleReviewLink} /></label>
          <button className="admin-primary-button" type="submit">Uložiť nastavenia</button>
        </form>
        <p>Aktuálna základná cena: {euro(settings.defaultPricePerM2)} / m²</p>
      </section>

      <section className="admin-card">
        <h2>Ceny materiálov</h2>
        <form className="admin-quote-form" action={savePriceOfferSettingsAction}>
          {Object.entries(priceOfferMaterialLabels).map(([key, label]) => (
            <label key={key}>{label}<input name={`material_${key}`} type="number" step="0.01" defaultValue={offerSettings.materialPrices[key as keyof typeof offerSettings.materialPrices]} /></label>
          ))}
          <label>Cena dokumentácia bez DPH<input name="documentationFee" type="number" step="0.01" defaultValue={offerSettings.documentationFee} /></label>
          <label>DPH sadzba %<input name="vatRate" type="number" step="0.01" defaultValue={offerSettings.vatRate} /></label>
          <label>Vyhotovil meno<input name="preparedByName" defaultValue={offerSettings.preparedByName} /></label>
          <label>Vyhotovil telefón<input name="preparedByPhone" defaultValue={offerSettings.preparedByPhone} /></label>
          <button className="admin-primary-button admin-form-wide" type="submit">Uložiť ceny ponúk</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Prístup do adminu</h2>
        <p>Prihlasovací email: <strong>{adminEmail() || 'TODO nastaviť ADMIN_EMAIL'}</strong></p>
        {passwordMessage ? <div className="admin-alert">{passwordMessage}</div> : null}
        <form className="admin-quote-form" action={changeAdminPasswordAction}>
          <label>Aktuálne heslo<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>Nové heslo<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label>Zopakovať nové heslo<input name="repeatPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
          <button className="admin-primary-button admin-form-wide" type="submit">Zmeniť heslo</button>
        </form>
        <p style={{ marginTop: 12 }}>
          Ak heslo zabudnete, použite stránku <a href="/admin/reset-password">obnovy hesla</a>. Vyžaduje resetovací token uložený v bezpečných premenných projektu.
        </p>
      </section>
    </main>
  );
}
