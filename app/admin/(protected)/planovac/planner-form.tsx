'use client';

import { useState } from 'react';
import type { PlannerAction, PlannerActionStatus, PlannerActionType } from '@/src/server/types';
import { savePlannerActionAction } from './actions';

export type PlannerJobOption = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  location: string;
  district: string;
  demolitionDate: string;
  plannedDate?: string;
  workerNames: string[];
};

const typeLabels: Record<PlannerActionType, string> = {
  DEMONTAZ: 'Demontáž', ODVOZ: 'Odvoz', DOKUMENTACIA: 'Dokumentácia', INE: 'Iné',
};
const statusLabels: Record<PlannerActionStatus, string> = {
  NAPLANOVANA: 'Naplánovaná', DOKONCENA: 'Dokončená', ZRUSENA: 'Zrušená', PRESUNUTA: 'Presunutá',
};

export default function PlannerForm({
  csrfToken,
  jobs,
  workerNames,
  selectedJobId,
  editAction,
  month,
  today,
  weatherSummary,
}: {
  csrfToken: string;
  jobs: PlannerJobOption[];
  workerNames: string[];
  selectedJobId: string;
  editAction?: PlannerAction;
  month: string;
  today: string;
  weatherSummary: string;
}) {
  const initialJob = jobs.find((job) => job.id === (editAction?.jobId || selectedJobId));
  const [jobId, setJobId] = useState(editAction?.jobId || selectedJobId);
  const [address, setAddress] = useState(editAction?.address || initialJob?.location || '');
  const [customerName, setCustomerName] = useState(editAction?.customerName || initialJob?.customerName || '');
  const [customerEmail, setCustomerEmail] = useState(editAction?.customerEmail || initialJob?.customerEmail || '');
  const [customerPhone, setCustomerPhone] = useState(editAction?.customerPhone || initialJob?.customerPhone || '');
  const [date, setDate] = useState(editAction?.date || initialJob?.plannedDate || initialJob?.demolitionDate || '');
  const initialWorkers = new Set((editAction?.workers ? editAction.workers.split(',') : initialJob?.workerNames || []).map((value) => value.trim()).filter(Boolean));
  const [selectedWorkers, setSelectedWorkers] = useState(initialWorkers);
  const [weatherIsCurrent, setWeatherIsCurrent] = useState(true);

  function selectJob(nextId: string) {
    setJobId(nextId);
    setWeatherIsCurrent(false);
    const job = jobs.find((item) => item.id === nextId);
    if (!job) return;
    setAddress(job.location);
    setCustomerName(job.customerName);
    setCustomerEmail(job.customerEmail);
    setCustomerPhone(job.customerPhone);
    setDate(job.plannedDate || job.demolitionDate || '');
    setSelectedWorkers(new Set(job.workerNames));
  }

  function toggleWorker(name: string, checked: boolean) {
    setSelectedWorkers((current) => {
      const next = new Set(current);
      if (checked) next.add(name); else next.delete(name);
      return next;
    });
  }

  return (
    <form className="admin-quote-form planner-modern-form" action={savePlannerActionAction}>
      <input type="hidden" name="_csrf" value={csrfToken} />
      <input type="hidden" name="id" value={editAction?.id || ''} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="returnJobId" value={jobId} />
      <label>Zákazka
        <select name="jobId" value={jobId} onChange={(event) => selectJob(event.target.value)}>
          <option value="">Bez prepojenia</option>
          {jobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} · {job.location}</option>)}
        </select>
      </label>
      <label>Typ
        <select name="type" defaultValue={editAction?.type || 'DEMONTAZ'}>
          {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Dátum<input name="date" type="date" required value={date} onChange={(event) => { setDate(event.target.value); setWeatherIsCurrent(false); }} /></label>
      <label>Stav
        <select name="status" defaultValue={editAction?.status || 'NAPLANOVANA'}>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Čas od<input name="timeFrom" type="time" required defaultValue={editAction?.timeFrom || '08:00'} /></label>
      <label>Čas do<input name="timeTo" type="time" required defaultValue={editAction?.timeTo || '16:00'} /></label>
      <label className="admin-form-wide">Adresa<input name="address" required maxLength={250} value={address} onChange={(event) => { setAddress(event.target.value); setWeatherIsCurrent(false); }} placeholder="Obec, ulica alebo presná adresa" /></label>
      <div className="admin-form-wide planner-workers">
        <span>Pracovníci</span>
        {workerNames.map((name) => <label className="admin-checkbox" key={name}><input name="workers" type="checkbox" value={name} checked={selectedWorkers.has(name)} onChange={(event) => toggleWorker(name, event.target.checked)} /> {name}</label>)}
        {!workerNames.length ? <small>Najprv pridajte aktívnych pracovníkov v nastaveniach.</small> : null}
      </div>
      <label>Meno zákazníka<input name="customerName" maxLength={160} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
      <label>Email zákazníka<input name="customerEmail" type="email" maxLength={254} value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></label>
      <label>Telefón zákazníka<input name="customerPhone" maxLength={40} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label>
      <label className="admin-form-wide">Poznámka<textarea name="note" rows={3} maxLength={1200} defaultValue={editAction?.note || ''} /></label>
      <div className="admin-form-wide planner-weather" aria-live="polite">
        <strong>Počasie pre okres zákazky a zvolený termín</strong>
        <span>{weatherIsCurrent ? weatherSummary : 'Zmenili ste zákazku, adresu alebo termín. Pôvodná predpoveď už neplatí; pred uložením ju overte ručne. Po uložení systém načíta údaj pre nový výber.'}</span>
        <small>Presná adresa sa externej službe neposiela. Pred odchodom vždy overte aktuálnu predpoveď; ide o pomocný údaj, nie automatické rozhodnutie.</small>
      </div>
      <div className="admin-form-wide planner-notifications">
        <strong>Upozornenia</strong>
        <label className="admin-checkbox"><input name="notify2Days" type="checkbox" defaultChecked={editAction?.notify2Days} /> Interné upozornenie 2 dni pred</label>
        <label className="admin-checkbox"><input name="notify1Day" type="checkbox" defaultChecked={editAction?.notify1Day} /> Interné upozornenie deň pred</label>
        <label className="admin-checkbox"><input name="notifyCustomer" type="checkbox" defaultChecked={editAction?.notifyCustomer} /> Email zákazníkovi 2 dni pred</label>
      </div>
      <div className="admin-form-wide admin-action-row">
        <button className="admin-primary-button" type="submit">{editAction ? 'Uložiť úpravu akcie' : 'Naplánovať akciu'}</button>
        {editAction ? <a className="admin-secondary-link" href={`/admin/planovac?mesiac=${month}${jobId ? `&zakazka=${jobId}` : ''}`}>Zrušiť úpravu</a> : null}
      </div>
    </form>
  );
}
