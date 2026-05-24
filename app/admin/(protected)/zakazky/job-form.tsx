'use client';

import { useMemo, useState } from 'react';
import type { BusinessJob, LandfillPrice, Worker } from '@/src/server/types';
import { euro, jobStatusLabels, jobStatuses, landfillLabels, landfills, paymentLabels, paymentTypes, workTypeLabels, workTypes } from './constants';

type Props = {
  workers: Worker[];
  landfillPrices: LandfillPrice[];
  defaultPricePerM2: number;
  job?: BusinessJob;
};

function n(value: string | number | undefined) {
  return Number(String(value ?? '').replace(',', '.')) || 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export default function JobForm({ workers, landfillPrices, defaultPricePerM2, job }: Props) {
  const initialWorkerIds = job?.workers.map((worker) => worker.workerId) ?? [];
  const [m2, setM2] = useState(job?.m2 ?? 0);
  const [pricePerM2, setPricePerM2] = useState(job?.pricePerM2 ?? defaultPricePerM2);
  const [date, setDate] = useState(job?.demolitionDate ?? new Date().toISOString().slice(0, 10));
  const [wasteKg, setWasteKg] = useState(job?.wasteKg ?? 0);
  const [landfill, setLandfill] = useState(job?.landfill ?? 'MOCHOVCE');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(initialWorkerIds);
  const [manualRewards, setManualRewards] = useState<Record<string, { reward: number; manual: boolean }>>(
    Object.fromEntries((job?.workers ?? []).map((worker) => [worker.workerId, { reward: worker.reward, manual: worker.manuallyEdited }])),
  );
  const [costs, setCosts] = useState({
    fuel: job?.costs.fuel ?? 0,
    suits: job?.costs.suits ?? 0,
    gloves: job?.costs.gloves ?? 0,
    penetrant: job?.costs.penetrant ?? 0,
    otherAmount: job?.costs.otherAmount ?? 0,
  });

  const landfillCost = useMemo(() => {
    if (!wasteKg || landfill === 'INA') return { value: 0, missing: false };
    const year = new Date(date).getFullYear();
    const price = landfillPrices.find((item) => item.year === year && item.landfill === landfill);
    if (!price) return { value: 0, missing: true };
    return { value: (wasteKg / 1000) * price.pricePerTon, missing: false };
  }, [date, landfill, landfillPrices, wasteKg]);

  const totalPrice = m2 * pricePerM2;
  const share = selectedWorkers.length ? round2(m2 / selectedWorkers.length) : 0;
  const rewards = selectedWorkers.map((workerId) => {
    const worker = workers.find((item) => item.id === workerId);
    const rate = job?.workers.find((item) => item.workerId === workerId)?.rate ?? worker?.ratePerM2 ?? 0;
    const automatic = round2(share * rate);
    const manual = manualRewards[workerId]?.manual;
    const reward = manual ? manualRewards[workerId]?.reward ?? automatic : automatic;
    return { workerId, worker, rate, reward, manual };
  });
  const rewardTotal = rewards.reduce((sum, item) => sum + item.reward, 0);
  const costsTotal = costs.fuel + costs.suits + costs.gloves + costs.penetrant + costs.otherAmount + landfillCost.value;
  const grossProfit = totalPrice - rewardTotal - costsTotal;
  const margin = totalPrice ? (grossProfit / totalPrice) * 100 : 0;

  return (
    <div className="business-form">
      {job ? <input type="hidden" name="id" value={job.id} /> : null}
      <section className="admin-card">
        <h2>Základné údaje</h2>
        <div className="admin-quote-form">
          <label>Dátum demontáže<input name="demolitionDate" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label>Meno zákazníka<input name="customerName" defaultValue={job?.customerName} required /></label>
          <label>Telefón zákazníka<input name="customerPhone" defaultValue={job?.customerPhone} /></label>
          <label>Email zákazníka<input name="customerEmail" type="email" defaultValue={job?.customerEmail} /></label>
          <label>Lokalita<input name="location" defaultValue={job?.location} required /></label>
          <label>Okres<input name="district" defaultValue={job?.district} /></label>
          <label>Typ materiálu<input name="materialType" defaultValue={job?.materialType} /></label>
          <label>Typ objektu<input name="objectType" defaultValue={job?.objectType} /></label>
          <label>Termín<input name="term" defaultValue={job?.term} /></label>
          <label>Stav<select name="status" defaultValue={job?.status ?? 'DOPYT'}>{jobStatuses.map((status) => <option key={status} value={status}>{jobStatusLabels[status]}</option>)}</select></label>
        </div>
      </section>

      <section className="admin-card">
        <h2>Rozsah a cena</h2>
        <div className="admin-quote-form">
          <label>m²<input name="m2" type="number" step="0.01" value={m2 || ''} onChange={(event) => setM2(n(event.target.value))} required /></label>
          <label>Cena za m²<input name="pricePerM2" type="number" step="0.01" value={pricePerM2 || ''} onChange={(event) => setPricePerM2(n(event.target.value))} required /></label>
          <label>Celková cena<input readOnly value={euro(totalPrice)} /></label>
          <fieldset><legend>Typ platby</legend>{paymentTypes.map((type) => <label className="admin-checkbox" key={type}><input type="radio" name="paymentType" value={type} defaultChecked={(job?.paymentType ?? 'FAKTURA') === type} /> {paymentLabels[type]}</label>)}</fieldset>
          <fieldset><legend>Typ práce</legend>{workTypes.map((type) => <label className="admin-checkbox" key={type}><input type="radio" name="workType" value={type} defaultChecked={(job?.workType ?? 'DEMONTAZ_A_ODVOZ') === type} /> {workTypeLabels[type]}</label>)}</fieldset>
        </div>
      </section>

      <section className="admin-card">
        <h2>Odpad a skládka</h2>
        <div className="admin-quote-form">
          <label>Váha odpadu v kg<input name="wasteKg" type="number" step="0.01" value={wasteKg || ''} onChange={(event) => setWasteKg(n(event.target.value))} /></label>
          <label>Skládka<select name="landfill" value={landfill} onChange={(event) => setLandfill(event.target.value as typeof landfill)}>{landfills.map((item) => <option key={item} value={item}>{landfillLabels[item]}</option>)}</select></label>
          <label>Náklad skládky €<input name="landfillCost" readOnly value={landfillCost.value.toFixed(2)} /></label>
        </div>
        {landfillCost.missing ? <p className="admin-alert">⚠ chýba cena skládky pre rok {new Date(date).getFullYear()}.</p> : null}
      </section>

      <section className="admin-card">
        <h2>Tím a odmeny</h2>
        <div className="worker-checks">
          {workers.map((worker) => (
            <label className="admin-checkbox" key={worker.id}>
              <input
                type="checkbox"
                value={worker.id}
                checked={selectedWorkers.includes(worker.id)}
                onChange={(event) => setSelectedWorkers((items) => event.target.checked ? [...items, worker.id] : items.filter((id) => id !== worker.id))}
              />
              {worker.name}
            </label>
          ))}
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Pracovník</th><th>m²/podiel</th><th>Sadzba</th><th>Odmena</th><th>Upraviť</th></tr></thead>
            <tbody>
              {rewards.map((item) => (
                <tr key={item.workerId}>
                  <td>{item.worker?.name}<input type="hidden" name="workerId" value={item.workerId} /></td>
                  <td>{share.toFixed(2)}</td>
                  <td><input name={`workerRate_${item.workerId}`} type="number" step="0.01" defaultValue={item.rate.toFixed(2)} /></td>
                  <td>
                    <input
                      name={`workerReward_${item.workerId}`}
                      type="number"
                      step="0.01"
                      value={item.reward.toFixed(2)}
                      onChange={(event) => setManualRewards((values) => ({ ...values, [item.workerId]: { reward: n(event.target.value), manual: true } }))}
                    />
                    <input type="hidden" name={`workerManual_${item.workerId}`} value={item.manual ? 'on' : ''} />
                  </td>
                  <td>
                    {item.manual ? '✎' : 'auto'}{' '}
                    <button type="button" onClick={() => setManualRewards((values) => ({ ...values, [item.workerId]: { reward: round2(share * item.rate), manual: false } }))}>↺ Prepočítať</button>
                  </td>
                </tr>
              ))}
              {!rewards.length ? <tr><td colSpan={5}>Vyberte pracovníkov.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Náklady</h2>
        <div className="admin-quote-form">
          {(['fuel', 'suits', 'gloves', 'penetrant'] as const).map((key) => (
            <label key={key}>{({ fuel: 'Nafta €', suits: 'Obleky €', gloves: 'Rukavice €', penetrant: 'Penetrák €' } as const)[key]}<input name={key} type="number" step="0.01" value={costs[key] || ''} onChange={(event) => setCosts((values) => ({ ...values, [key]: n(event.target.value) }))} /></label>
          ))}
          <label>Iné — názov<input name="otherName" defaultValue={job?.costs.otherName} /></label>
          <label>Iné — suma €<input name="otherAmount" type="number" step="0.01" value={costs.otherAmount || ''} onChange={(event) => setCosts((values) => ({ ...values, otherAmount: n(event.target.value) }))} /></label>
          <label>Náklady spolu<input readOnly value={euro(costsTotal)} /></label>
        </div>
      </section>

      <section className="admin-card">
        <h2>Ziskovosť</h2>
        <dl className="admin-dl">
          <dt>Tržba</dt><dd>{euro(totalPrice)}</dd>
          <dt>Odmeny</dt><dd>{euro(rewardTotal)}</dd>
          <dt>Náklady</dt><dd>{euro(costsTotal)}</dd>
          <dt>Hrubý zisk</dt><dd>{euro(grossProfit)}</dd>
          <dt>Marža</dt><dd>{margin.toFixed(1)} %</dd>
        </dl>
        <label>Poznámka<textarea name="note" rows={4} defaultValue={job?.note} /></label>
      </section>
    </div>
  );
}
