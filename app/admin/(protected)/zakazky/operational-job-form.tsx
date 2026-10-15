import type { OperationalBusinessJob } from '@/src/server/types';
import { jobStatusLabels, jobStatuses } from './constants';

export default function OperationalJobForm({ job }: { job: OperationalBusinessJob }) {
  const availableStatuses = job.status === 'DOKONCENA' ? jobStatuses : jobStatuses.filter((status) => status !== 'DOKONCENA');
  return (
    <div className="business-form">
      <input type="hidden" name="id" value={job.id} />
      <div className="admin-quote-form">
        <label>Dátum demontáže<input name="demolitionDate" type="date" defaultValue={job.demolitionDate} required /></label>
        <label>Meno zákazníka<input name="customerName" defaultValue={job.customerName} maxLength={160} required /></label>
        <label>Telefón zákazníka<input name="customerPhone" defaultValue={job.customerPhone} maxLength={60} /></label>
        <label>Email zákazníka<input name="customerEmail" type="email" defaultValue={job.customerEmail} maxLength={254} /></label>
        <label>Lokalita<input name="location" defaultValue={job.location} maxLength={240} required /></label>
        <label>Okres<input name="district" defaultValue={job.district} maxLength={120} /></label>
        <label>Typ materiálu<input name="materialType" defaultValue={job.materialType} maxLength={160} /></label>
        <label>Typ objektu<input name="objectType" defaultValue={job.objectType} maxLength={160} /></label>
        <label>Termín<input name="term" defaultValue={job.term} maxLength={160} /></label>
        <label>Preferovaný kontakt<input name="preferredContact" defaultValue={job.preferredContact} maxLength={160} /></label>
        <label>Stav<select name="status" defaultValue={job.status}>{availableStatuses.map((status) => <option key={status} value={status}>{jobStatusLabels[status]}</option>)}</select><small>Stav „Dokončená“ nastavuje iba riadený sprievodca.</small></label>
        <label className="admin-form-wide">Interná poznámka<textarea name="note" rows={4} maxLength={4000} defaultValue={job.note} /></label>
      </div>
      <p className="admin-muted-note">Ceny, náklady, odmeny, fakturácia a finančné nastavenia môže meniť iba superadmin. Toto uloženie ich zachová bez zmeny.</p>
    </div>
  );
}
