import { csrfTokenForEmail, requireSuperAdmin } from '@/src/server/auth';
import { getAdminSetting, getBusinessSettings, getPriceOfferSettings, listAdminUsers, listLandfillPrices, listWorkers } from '@/src/server/db';
import JobSettingsForm from './job-settings-form';
import { priceOfferMaterialLabels } from '../ponuky/constants';
import { euro, landfillLabels, landfills } from '../zakazky/constants';
import { changeAdminPasswordAction, deleteLandfillPriceAction, disconnectGmailPriceOfferAction, retryGmailPriceOfferJobsAction, saveGeneralSettingsAction, saveLandfillPriceAction, savePriceOfferSettingsAction, saveWorkerAction } from './actions';
import { getGmailPriceOfferConfiguration } from '@/src/server/gmail-price-offer-config';
import { getGmailPriceOfferConnection, getGmailPriceOfferJobSummary } from '@/src/server/gmail-price-offer-db';

export default async function SettingsAdminPage({ searchParams }: { searchParams?: Promise<{ heslo?: string; gmail?: string }> }) {
  const admin = await requireSuperAdmin();
  const csrfToken = csrfTokenForEmail(admin.email);
  const [workers, prices, settings, offerSettings, gmailConnection, gmailJobs] = await Promise.all([
    listWorkers(true), listLandfillPrices(), getBusinessSettings(), getPriceOfferSettings(),
    getGmailPriceOfferConnection(), getGmailPriceOfferJobSummary(),
  ]);
  const gmailConfig = getGmailPriceOfferConfiguration();
  const params = await searchParams;
  const [ownerEmail, adminUsers] = await Promise.all([getAdminSetting('job_workspace_default_responsible_email'), listAdminUsers()]);
  const passwordMessage =
    params?.heslo === 'ulozene'
      ? 'Heslo bolo zmenené.'
      : params?.heslo === 'nespravne'
        ? 'Aktuálne heslo nesedí.'
        : params?.heslo === 'neplatne'
          ? 'Nové heslo musí mať 12 až 128 znakov a obe hodnoty musia byť rovnaké.'
          : params?.heslo === 'konflikt'
            ? 'Účet sa medzitým zmenil. Obnovte stránku a skúste to znova.'
          : '';
  const gmailMessage = params?.gmail === 'ok'
    ? 'Gmail bol bezpečne pripojený. Nové odoslané ponuky sa označia automaticky.'
    : params?.gmail === 'disconnected' ? 'Gmail bol odpojený. Odosielanie ponúk zostáva funkčné, označenie sa pozastaví.'
      : params?.gmail === 'requeued' ? 'Problémové Gmail označenia boli vrátené na bezpečné opakovanie.'
        : params?.gmail === 'nothing_to_retry' ? 'Nie sú žiadne problémové Gmail označenia na opakovanie.'
          : params?.gmail === 'configuration' ? 'Najprv treba doplniť bezpečné Gmail OAuth nastavenia vo Verceli.'
            : params?.gmail === 'state' ? 'Platnosť pripojenia vypršala alebo už bolo použité. Spustite ho znova.'
              : params?.gmail === 'account' ? 'Bol zvolený iný Gmail účet, než povoľuje bezpečnostné nastavenie.'
                : params?.gmail === 'cancelled' ? 'Pripojenie Gmailu bolo zrušené bez zmeny.'
                  : params?.gmail === 'failed' ? 'Gmail pripojenie sa nepodarilo dokončiť. Skontrolujte Google oprávnenia.' : '';

  return (
    <main className="admin-page">
      <div className="admin-heading"><div><p>Konfigurácia</p><h1>Nastavenia</h1></div></div>
      <section className="admin-card"><h2>Gmail a zákazkové karty</h2><p>Skontrolované správy a pôvodné PDF ponuky môžete priradiť ku konkrétnej zákazke.</p><a className="admin-row-link" href="/admin/nastavenia/gmail">Rozsah a kontrola komunikácie →</a></section>
      <JobSettingsForm csrfToken={csrfToken} selectedEmail={ownerEmail || ''} users={adminUsers.filter(user => user.active && ['OPERATOR', 'SUPER_ADMIN'].includes(user.role)).map(user => ({ email: user.email, name: user.name }))} />

      <section className="admin-card">
        <h2>Ceny skládok</h2>
        <form className="admin-filter-bar" action={saveLandfillPriceAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>Rok<input name="year" type="number" defaultValue={new Date().getFullYear()} /></label>
          <label>Skládka<select name="landfill">{landfills.map((item) => <option key={item} value={item}>{landfillLabels[item]}</option>)}</select></label>
          <label>€/tonu<input name="pricePerTon" type="number" step="0.01" /></label>
          <button type="submit">Pridať</button>
        </form>
        <div className="admin-table-wrap">
          <table className="admin-table admin-settings-table">
            <thead><tr><th>Rok</th><th>Skládka</th><th>€/tonu</th><th>Upraviť</th><th></th></tr></thead>
            <tbody>{prices.map((price) => (
              <tr key={price.id}>
                <td colSpan={5}>
                  <div className="admin-table-inline-actions">
                    <form action={saveLandfillPriceAction} className="admin-table-inline-form">
                      <input type="hidden" name="_csrf" value={csrfToken} />
                      <input name="year" type="number" defaultValue={price.year} aria-label="Rok" />
                      <select name="landfill" defaultValue={price.landfill} aria-label="Skládka">{landfills.map((item) => <option key={item} value={item}>{landfillLabels[item]}</option>)}</select>
                      <input name="pricePerTon" type="number" step="0.01" defaultValue={price.pricePerTon} aria-label="Cena za tonu" />
                      <input type="hidden" name="id" value={price.id} />
                      <button type="submit">Uložiť</button>
                    </form>
                    <form action={deleteLandfillPriceAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="id" value={price.id} /><button type="submit">Zmazať</button></form>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Pracovníci</h2>
        <div className="admin-table-wrap">
          <table className="admin-table admin-settings-table">
            <thead><tr><th>Meno</th><th>Sadzba €/m2</th><th>Aktívny</th><th></th></tr></thead>
            <tbody>{workers.map((worker) => (
              <tr key={worker.id}>
                <td colSpan={4}>
                  <form action={saveWorkerAction} className="admin-table-inline-form admin-table-inline-form-workers">
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <input name="name" defaultValue={worker.name} aria-label="Meno pracovníka" />
                    <input name="ratePerM2" type="number" step="0.01" defaultValue={worker.ratePerM2} aria-label="Sadzba za m2" />
                    <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={worker.active} /> Aktívny</label>
                    <input type="hidden" name="id" value={worker.id} />
                    <button type="submit">Uložiť</button>
                  </form>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <form className="admin-filter-bar" action={saveWorkerAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>Meno<input name="name" /></label>
          <label>Sadzba<input name="ratePerM2" type="number" step="0.01" /></label>
          <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked /> Aktívny</label>
          <button type="submit">Pridať pracovníka</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Predvolené hodnoty</h2>
        <form className="admin-quote-form" action={saveGeneralSettingsAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>Základná cena za m2<input name="defaultPricePerM2" type="number" step="0.01" defaultValue={settings.defaultPricePerM2} /></label>
          <label className="admin-form-wide">Google review link<input name="googleReviewLink" defaultValue={settings.googleReviewLink} /></label>
          <button className="admin-primary-button" type="submit">Uložiť nastavenia</button>
        </form>
        <p>Aktuálna základná cena: {euro(settings.defaultPricePerM2)} / m2</p>
      </section>

      <section className="admin-card">
        <h2>Ceny materiálov</h2>
        <form className="admin-quote-form" action={savePriceOfferSettingsAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
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
        <p>Prihlasovací email: <strong>{admin.email}</strong></p>
        {passwordMessage ? <div className="admin-alert">{passwordMessage}</div> : null}
        <form className="admin-quote-form" action={changeAdminPasswordAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>Aktuálne heslo<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label>Nové heslo<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <label>Zopakovať nové heslo<input name="repeatPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <button className="admin-primary-button admin-form-wide" type="submit">Zmeniť heslo</button>
        </form>
        <p style={{ marginTop: 12 }}>
          Ak heslo zabudnete, použite stránku <a href="/admin/reset-password">obnovy hesla</a>. Vyžaduje resetovací token uložený v bezpečných premenných projektu.
        </p>
      </section>

      <section className="admin-card" aria-labelledby="gmail-price-offer-title">
        <div className="admin-heading-row">
          <div>
            <p className="admin-eyebrow">AUTOMATIZÁCIA PONÚK</p>
            <h2 id="gmail-price-offer-title">Prepojenie Gmailu</h2>
          </div>
          <span className={gmailConnection ? 'admin-status-badge is-success' : 'admin-status-badge'}>
            {gmailConnection ? 'Pripojené' : 'Nepripojené'}
          </span>
        </div>
        {gmailMessage ? <div className={['ok', 'disconnected', 'requeued', 'nothing_to_retry'].includes(params?.gmail || '') ? 'admin-alert is-success' : 'admin-alert'} role="status">{gmailMessage}</div> : null}
        {gmailConnection ? (
          <>
            <p>Účet <strong>{gmailConnection.emailAddress}</strong> automaticky označuje ponuky zeleným štítkom <strong>{gmailConnection.labelName}</strong>.</p>
            <div className="admin-inline-stats" aria-label="Stav Gmail označení">
              <span>Čaká <strong>{gmailJobs.pending + gmailJobs.processing + gmailJobs.retry}</strong></span>
              <span>Hotovo <strong>{gmailJobs.completed}</strong></span>
              <span>Treba skontrolovať <strong>{gmailJobs.attention}</strong></span>
            </div>
            {gmailConnection.lastErrorCode ? <p className="admin-alert">Pripojenie vyžaduje kontrolu: {gmailConnection.lastErrorCode}</p> : null}
            <div className="admin-action-row">
              {gmailJobs.attention ? <form action={retryGmailPriceOfferJobsAction}><input type="hidden" name="_csrf" value={csrfToken} /><button className="admin-secondary-button" type="submit">Znova skúsiť problémové označenia</button></form> : null}
              <form action={disconnectGmailPriceOfferAction} data-confirm-submit="Naozaj odpojiť Gmail? Ponuky sa budú naďalej odosielať, ale neoznačia sa v Gmaili.">
                <input type="hidden" name="_csrf" value={csrfToken} />
                <button className="admin-danger-outline" type="submit">Odpojiť Gmail</button>
              </form>
            </div>
          </>
        ) : (
          <>
            <p>Po pripojení sa každá cenová ponuka úspešne odoslaná z adminu označí v Gmaili zeleným štítkom a hviezdičkou. Gmail heslo sa sem nikdy nezadáva.</p>
            {gmailConfig.configured
              ? <a className="admin-primary-link" href="/api/google/gmail/oauth/start">Pripojiť Gmail bezpečne</a>
              : <p className="admin-muted-note">Chýbajúce nastavenia: {gmailConfig.missing.join(', ')}.</p>}
          </>
        )}
        <p className="admin-muted-note">Chyba označenia nikdy nespôsobí opätovné odoslanie cenovej ponuky.</p>
      </section>

      <section className="admin-card">
        <h2>E-mail astana@astana.sk</h2>
        <p>Heslo schránky sa z bezpečnostných dôvodov neukladá ani nezobrazuje v tomto adminovi.</p>
        <ol>
          <li>Zmeňte heslo v oficiálnej správe HostCreators.</li>
          <li>Rovnaké nové heslo uložte vo Verceli do premennej <strong>SMTP_PASS</strong>.</li>
          <li>Po novom nasadení overte SMTP v časti Kontrola systému.</li>
        </ol>
        <p className="admin-inline-actions">
          <a className="admin-secondary-link" href="https://www.hostcreators.sk/admin/host/domain/14352/edit" target="_blank" rel="noreferrer">Otvoriť HostCreators</a>
          <a className="admin-secondary-link" href="https://vercel.com/laufzdeno-3815s-projects/likvidacia-eternitu-sk/settings/environment-variables" target="_blank" rel="noreferrer">Otvoriť SMTP_PASS vo Verceli</a>
          <a className="admin-secondary-link" href="/admin/health">Skontrolovať systém</a>
        </p>
      </section>
    </main>
  );
}
