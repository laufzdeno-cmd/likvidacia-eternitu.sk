import { requireSuperAdmin } from '@/src/server/auth';
import { listAdminUsers } from '@/src/server/db';
import { resetAdminUserTwoFactorAction, saveAdminUserAction, toggleAdminUserAction } from './actions';

export default async function AdminUsersPage() {
  const actor = await requireSuperAdmin();
  const users = await listAdminUsers();

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Správa prístupov</p>
          <h1>Používatelia</h1>
        </div>
      </div>

      <section className="admin-card">
        <h2>Pridať používateľa</h2>
        <form className="admin-quote-form" action={saveAdminUserAction}>
          <label>Meno<input name="name" placeholder="napr. Operátor" /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Heslo<input name="password" type="password" minLength={8} required /></label>
          <label>Rola<select name="role" defaultValue="OPERATOR"><option value="OPERATOR">Operátor</option><option value="SUPER_ADMIN">Super admin</option></select></label>
          <label className="admin-checkbox"><input name="active" type="checkbox" defaultChecked /> Aktívny</label>
          <button className="admin-primary-button admin-form-wide" type="submit">Pridať používateľa</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Existujúci používatelia</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Meno</th><th>Email</th><th>Rola</th><th>Aktívny</th><th>2FA</th><th>Akcia</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name || '—'}</td>
                  <td>{user.email}</td>
                  <td><span className="status-pill">{user.role === 'SUPER_ADMIN' ? 'Super admin' : 'Operátor'}</span></td>
                  <td>{user.active ? 'Áno' : 'Nie'}</td>
                  <td>
                    {user.role === 'SUPER_ADMIN' ? (
                      <span className="status-pill">2FA: Povinné</span>
                    ) : (
                      <span className="status-pill">2FA: Voliteľné {user.twoFactorEnabled ? 'Aktívne' : '[Zapnúť]'}</span>
                    )}
                  </td>
                  <td>
                    <form action={toggleAdminUserAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="active" value={String(!user.active)} />
                      <button type="submit">{user.active ? 'Deaktivovať' : 'Aktivovať'}</button>
                    </form>
                    {(user.twoFactorEnabled || user.twoFactorSecret) && user.email !== actor.email ? (
                      <form action={resetAdminUserTwoFactorAction} data-confirm-submit={`Resetovať 2FA pre ${user.email}?`}>
                        <input type="hidden" name="id" value={user.id} />
                        <button type="submit">Resetovať 2FA</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!users.length ? <tr><td colSpan={6}>Zatiaľ nie je vytvorený žiadny používateľ.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
