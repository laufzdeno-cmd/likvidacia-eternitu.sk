'use client';

import { useActionState } from 'react';
import { saveJobDefaultOwnerAction } from './job-settings-actions';

export default function JobSettingsForm({ csrfToken, selectedEmail, users }: { csrfToken: string; selectedEmail: string; users: Array<{ email: string; name: string }> }) {
  const [state, action, pending] = useActionState(saveJobDefaultOwnerAction, { message: '' });
  return <section className="admin-card"><h2>Odovzdanie prijatej zákazky</h2><p>Vyberte Slávku alebo inú zodpovednú osobu. Nové prijaté ponuky dostanú zákazkovú kartu a toto priradenie. Existujúce zákazky sa spätne nemenia.</p><form action={action} className="admin-filter-bar"><input type="hidden" name="_csrf" value={csrfToken} /><label>Zodpovedná osoba<select name="responsibleEmail" defaultValue={selectedEmail}><option value="">Vybrať ručne pri každej zákazke</option>{users.map(user => <option key={user.email} value={user.email}>{user.name || user.email} · {user.email}</option>)}</select></label><button disabled={pending}>{pending ? 'Ukladám…' : 'Uložiť odovzdanie'}</button></form>{state.message ? <p role="status">{state.message}</p> : null}</section>;
}
