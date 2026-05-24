'use client';

import { useMemo, useState } from 'react';

function parseLine(line: string) {
  return line.split(/[;,]/).map((item) => item.trim());
}

export default function ImportClient() {
  const [csv, setCsv] = useState('');
  const rows = useMemo(() => {
    const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const data = lines[0]?.toLowerCase().includes('datum') ? lines.slice(1) : lines;
    return data.map((line, index) => {
      const cols = parseLine(line);
      const errors = [];
      if (!cols[0]) errors.push('chýba dátum');
      if (!cols[1]) errors.push('chýba meno');
      if (!cols[2]) errors.push('chýba lokalita');
      if (!Number(String(cols[3] || '').replace(',', '.'))) errors.push('chýba m²');
      return { index: index + 1, cols, errors };
    });
  }, [csv]);

  async function loadFile(file?: File) {
    if (!file) return;
    setCsv(await file.text());
  }

  return (
    <>
      <label>
        CSV súbor
        <input type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} />
      </label>
      <label>
        CSV obsah
        <textarea name="csv" rows={10} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="datum, meno, lokalita, m2, cena_za_m2, platba..." />
      </label>
      <h2>Preview pred importom</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Riadok</th><th>Dátum</th><th>Meno</th><th>Lokalita</th><th>m²</th><th>Chyby</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.index} className={row.errors.length ? 'is-error-row' : ''}><td>{row.index}</td><td>{row.cols[0]}</td><td>{row.cols[1]}</td><td>{row.cols[2]}</td><td>{row.cols[3]}</td><td>{row.errors.join(', ') || 'OK'}</td></tr>)}</tbody>
        </table>
      </div>
      <button className="admin-primary-button" type="submit" disabled={!rows.length || rows.some((row) => row.errors.length)}>
        Importovať {rows.filter((row) => !row.errors.length).length} zákaziek
      </button>
    </>
  );
}
