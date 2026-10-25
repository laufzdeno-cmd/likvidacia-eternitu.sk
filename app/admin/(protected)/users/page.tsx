import { csrfTokenForEmail, requireSuperAdmin } from '@/src/server/auth';
import { listAdminUsers } from '@/src/server/db';
import { resetAdminUserTwoFactorAction, saveAdminUserAction } from './actions';

const statusMessages: Record<string, string> = {
  '2fa-reset': 'Dvojfaktorové overenie používateľa bolo resetované.',
  'chyba': 'Zmenu sa nepodarilo uložiť. Skúste to znova.',
  'chyba-heslo': 'Aktívny účet musí mať nastavené heslo.',
  'duplicitny-email': 'Tento e-mail už používa iný účet.',
  'konflikt': 'Účet sa medzitým zmenil. Obnovte stránku a skúste to znova.',
  'nenajdeny': 'Používateľ sa nenašiel.',
  'neplatne-udaje': 'Skontrolujte meno, e-mail a zvolenú rolu.',
  'nespravne-heslo': 'Aktuálne heslo superadmina nesedí.',
  'posledny-superadmin': 'Posledný aktívny superadmin sa nedá deaktivovať ani zmeniť na operátora.',
  'pristup-zmeneny': 'Vaše oprávnenie sa medzitým zmenilo. Prihláste sa znova.',
  'slabe-heslo': 'Heslo musí mať 12 až 128 znakov.',
  'ulozeny': 'Používateľ bol bezpečne upravený.',
  'vlastny-pristup': 'Nemôžete si odobrať vlastný prístup alebo rolu superadmina.',
  'vytvoreny': 'Používateľ bol vytvorený.',
};

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<{ stav?: string }> }) {
  const actor = await requireSuperAdmin();
  const users = await listAdminUsers();
  const csrfToken = csrfTokenForEmail(actor.email);
  const status = (await searchParams)?.stav || '';

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Správa prístupov</p>
          <h1>Používatelia</h1>
        </div>
      </div>

      {statusMessages[status] ? <div className="admin-alert" role="status">{statusMessages[status]}</div> : null}

      <section className="admin-card">
        <h2>Pridať používateľa</h2>
        <form className="admin-quote-form" action={saveAdminUserAction}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>Meno<input name="name" placeholder="napr. Operátor" required maxLength={120} /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Heslo<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>
          <label>Vaše aktuálne heslo<input name="currentPassword" type="password" maxLength={128} autoComplete="current-password" required /></label>
          <label>Rola<select name="role" defaultValue="OPERATOR"><option value="OPERATOR">Operátor</option><option value="META_REVIEWER">Kontrolór Meta – iba Facebook</option><option value="SUPER_ADMIN">Super admin</option></select></label>
          <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked /> Aktívny</label>
          <button className="admin-primary-button admin-form-wide" type="submit">Pridať používateľa</button>
        </form>
        <p>Operátor vidí pracovné časti CRM, ale nemá prístup k nastaveniam, používateľom, auditu ani systémovej kontrole. Dočasný kontrolór Meta vidí iba Facebook schránku a po ukončení kontroly sa jeho účet deaktivuje.</p>
      </section>

      <section className="admin-card">
        <h2>Existujúci používatelia</h2>
        <div className="admin-user-list">
          {users.map((user) => (
            <article className="admin-user-card" key={user.id}>
              <header className="admin-user-card-heading">
                <div>
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                </div>
                <div className="admin-user-card-statuses" aria-label="Stav účtu">
                  <span className="status-pill">{user.role === 'SUPER_ADMIN' ? 'Super admin' : user.role === 'META_REVIEWER' ? 'Kontrolór Meta' : 'Operátor'}</span>
                  <span className="status-pill">{user.active ? 'Aktívny' : 'Neaktívny'}</span>
                </div>
              </header>

              <form className="admin-user-edit-form" action={saveAdminUserAction}>
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="id" value={user.id} />
                <input type="hidden" name="expectedSessionEpoch" value={user.sessionEpoch} />
                <label>Meno<input name="name" defaultValue={user.name} required maxLength={120} /></label>
                <label>Email<input name="email" type="email" defaultValue={user.email} required maxLength={254} /></label>
                <label>Rola<select name="role" defaultValue={user.role}><option value="OPERATOR">Operátor</option><option value="META_REVIEWER">Kontrolór Meta – iba Facebook</option><option value="SUPER_ADMIN">Super admin</option></select></label>
                <label>Nové heslo<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="Nechať nezmenené" /></label>
                <label>Vaše aktuálne heslo<input name="currentPassword" type="password" maxLength={128} autoComplete="current-password" required /></label>
                <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked={user.active} /> Aktívny účet</label>
                <button className="admin-primary-button" type="submit">Uložiť účet</button>
              </form>

              <div className="admin-user-card-security">
                <div>
                  <strong>Dvojfaktorové overenie</strong>
                  <p>
                    {user.role === 'SUPER_ADMIN'
                      ? 'Povinné pre superadmina.'
                      : 'Pre operátora je vypnuté. Staré nastavenie 2FA možno vymazať tlačidlom nižšie.'}
                  </p>
                </div>
                {(user.twoFactorEnabled || user.twoFactorSecret) && user.email !== actor.email ? (
                  <form action={resetAdminUserTwoFactorAction} data-confirm-submit={`Resetovať 2FA pre ${user.email}?`}>
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <input type="hidden" name="id" value={user.id} />
                    <label>Vaše aktuálne heslo<input name="currentPassword" type="password" maxLength={128} autoComplete="current-password" required /></label>
                    <button className="admin-danger-outline" type="submit">Resetovať 2FA</button>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
          {!users.length ? <p>Zatiaľ nie je vytvorený žiadny používateľ.</p> : null}
        </div>
      </section>
    </main>
  );
}
