'use client';

import { useActionState } from 'react';
import { revealPendingBackupCodesAction, type BackupCodesRevealState } from '../actions';

const initialState: BackupCodesRevealState = { codes: [], error: '' };

export default function BackupCodesReveal({ csrfToken }: { csrfToken: string }) {
  const [state, action, pending] = useActionState(revealPendingBackupCodesAction, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="_csrf" value={csrfToken} />
      {!state.codes.length ? (
        <button className="button button-primary" type="submit" disabled={pending} style={{ width: '100%' }}>
          {pending ? 'Načítavam kódy…' : 'Zobraziť zálohovacie kódy'}
        </button>
      ) : (
        <>
          <div className="admin-alert">Tieto kódy sa už po obnovení stránky nezobrazia. Bezpečne si ich uložte.</div>
          <ul style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 0, listStyle: 'none' }}>
            {state.codes.map((code) => <li key={code}><code>{code}</code></li>)}
          </ul>
        </>
      )}
      {state.error ? <div className="admin-alert" role="alert">{state.error}</div> : null}
    </form>
  );
}
