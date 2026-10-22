'use client';

import { useActionState, useMemo, useState } from 'react';
import { importBusinessJobsAction, type ImportActionState } from './actions';
import { parseImportCsv } from './csv-import';

const initialState: ImportActionState = { status: 'idle', message: '', errors: [] };

export default function ImportClient({ workerNames }: { workerNames: string[] }) {
  const [csv, setCsv] = useState('');
  const [submittedCsv, setSubmittedCsv] = useState('');
  const [state, formAction, pending] = useActionState(importBusinessJobsAction, initialState);
  const preview = useMemo(() => parseImportCsv(csv, workerNames), [csv, workerNames]);
  const rowErrors = preview.rows.flatMap((row) => row.errors.map((error) => `Riadok ${row.line}: ${error}`));
  const canImport = preview.rows.length > 0 && !preview.errors.length && !rowErrors.length;

  async function loadFile(file?: File) {
    if (!file) return;
    setCsv(await file.text());
  }

  return (
    <form action={formAction} onSubmit={() => setSubmittedCsv(csv)} className="admin-quote-form">
      <label>
        CSV súbor
        <input type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} />
      </label>
      <label>
        CSV obsah
        <textarea name="csv" rows={10} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="id_zakazky,datum,meno,lokalita,m2,cena_za_m2,platba,..." />
      </label>
      <h2>Náhľad pred importom</h2>
      <p>CSV musí mať hlavičku a presne 16 stĺpcov vrátane jedinečného ID každej zákazky. Pri bodkočiarkovom CSV uzavrite pole so zoznamom pracovníkov do úvodzoviek.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Riadok</th><th>ID</th><th>Dátum</th><th>Meno</th><th>Lokalita</th><th>m2</th><th>Kontrola</th></tr></thead>
          <tbody>{preview.rows.map((row) => <tr key={row.line} className={row.errors.length ? 'is-error-row' : ''}><td>{row.line}</td><td>{row.columns[0]}</td><td>{row.columns[1]}</td><td>{row.columns[2]}</td><td>{row.columns[3]}</td><td>{row.columns[4]}</td><td>{row.errors.join('; ') || 'OK'}</td></tr>)}</tbody>
        </table>
      </div>
      {(preview.errors.length > 0 || rowErrors.length > 0) && (
        <div role="alert"><p>Opravte CSV pred importom:</p><ul>{[...preview.errors, ...rowErrors].map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>
      )}
      {state.message && submittedCsv === csv && <div role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite"><p>{state.message}</p>{state.errors.length > 0 && <ul>{state.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>}</div>}
      <button className="admin-primary-button" type="submit" disabled={!canImport || pending}>
        {pending ? 'Importujem…' : `Importovať ${preview.rows.length} zákaziek`}
      </button>
    </form>
  );
}
