import { requireSuperAdmin } from '@/src/server/auth';
import { listAuditLogs } from '@/src/server/db';

const entityLabels: Record<string, string> = {
  lead: 'Dopyt',
  business_job: 'Zákazka',
  quote: 'Ponuka',
  system: 'Systém',
  admin_user: 'Používateľ',
  site_content: 'Obsah webu',
  roofer: 'Strechár',
  roofer_registration: 'Registrácia strechára',
  career_application: 'Žiadosť o spoluprácu',
  review_request: 'Žiadosť o recenziu',
  testimonial: 'Referencia',
  realization: 'Realizácia',
  planner_action: 'Plánovač',
  admin_work_item: 'Interná úloha',
};

const actionLabels: Record<string, string> = {
  lead_created: 'Dopyt vytvorený',
  status_changed: 'Workflow zmenený',
  followup_scheduled: 'Následný kontakt naplánovaný',
  followup_cancelled: 'Následný kontakt zrušený',
  internal_note_changed: 'Interná poznámka zmenená',
  lead_archived: 'Dopyt archivovaný',
  lead_restored: 'Dopyt obnovený',
  lead_deleted: 'Dopyt trvalo odstránený',
  lead_file_deleted: 'Súbor odstránený',
  business_jobs_exported: 'Export zákaziek',
  analytics_exported: 'Export analytiky',
  business_finance_exported: 'Finančný export vytvorený',
  business_job_created: 'Zákazka vytvorená',
  business_job_updated: 'Zákazka upravená',
  business_job_status_changed: 'Stav zákazky zmenený',
  business_invoice_recorded: 'Faktúra zaevidovaná',
  business_invoice_cancelled: 'Faktúra stornovaná',
  business_payment_recorded: 'Úhrada zaevidovaná',
  business_payment_reversed: 'Úhrada stornovaná',
  quote_created: 'Ponuka vytvorená',
  quote_updated: 'Ponuka upravená',
  price_offer_email_sent: 'Ponuka odoslaná emailom',
  price_offer_email_error: 'Chyba odoslania ponuky',
  site_content_updated: 'Obsah webu upravený',
  site_content_restored: 'Staršia verzia obsahu obnovená',
  admin_user_created: 'Používateľ vytvorený',
  admin_user_updated: 'Používateľ upravený',
  admin_user_active_changed: 'Aktivita používateľa zmenená',
  admin_work_item_created: 'Interná úloha vytvorená',
  admin_work_item_updated: 'Interná úloha upravená',
  admin_work_item_completed: 'Interná úloha dokončená',
  admin_work_item_reopened: 'Interná úloha znovu otvorená',
  admin_work_item_cancelled: 'Interná úloha zrušená',
  review_request_form_interaction_recorded: 'Zaznamenaná interakcia s formulárom referencie',
};

const changeLabels: Record<string, string> = {
  invoiceId: 'ID faktúry',
  paymentEventId: 'ID udalosti úhrady',
  reversalOf: 'Oprava udalosti',
  issuedOn: 'Dátum vystavenia',
  dueOn: 'Dátum splatnosti',
  cancelledOn: 'Dátum storna',
  occurredOn: 'Dátum úhrady / opravy',
  amountWithoutVatCents: 'Suma bez DPH',
  amountWithVatCents: 'Suma s DPH',
  amountCents: 'Suma',
  vatRateBasisPoints: 'Sadzba DPH',
  method: 'Spôsob úhrady',
  allocated: 'Priradená k faktúre',
  reasonCode: 'Dôvod opravy',
  status: 'Stav',
  priority: 'Priorita',
  dueDate: 'Termín',
  hasOwner: 'Má vlastníka',
  visibility: 'Viditeľnosť',
  revision: 'Revízia',
  changedFields: 'Zmenené polia',
  keys: 'Upravené textové polia',
  contentHash: 'Kontrolný odtlačok verzie',
  restoredFromId: 'Zdrojová verzia',
  previous: 'Predchádzajúci stav',
  next: 'Nový stav',
};

const workItemValueLabels: Record<string, string> = {
  OPEN: 'Otvorená', DONE: 'Dokončená', CANCELLED: 'Zrušená',
  CRITICAL: 'Kritická', HIGH: 'Vysoká', NORMAL: 'Bežná', LOW: 'Nízka',
  TEAM: 'Celý tím', SUPER_ADMIN: 'Iba superadmin',
  opened: 'Interakcia s formulárom zaznamenaná',
  title: 'názov', note: 'poznámka', priority: 'priorita', dueDate: 'termín', ownerEmail: 'vlastník', visibility: 'viditeľnosť',
};

const money = new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' });
const paymentMethodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Bankový prevod',
  CASH: 'Hotovosť',
  CARD: 'Karta',
  OTHER: 'Iné',
};
const reasonLabels: Record<string, string> = {
  DATA_ERROR: 'Chybne zaevidované údaje',
  DUPLICATE: 'Duplicitný záznam',
  CUSTOMER_CANCELLED: 'Zrušenie zákazníkom',
  REFUNDED: 'Vrátenie platby',
  OTHER: 'Iný interný dôvod',
};

function formatChangeValue(key: string, value: unknown) {
  if (['amountWithoutVatCents', 'amountWithVatCents', 'amountCents'].includes(key) && typeof value === 'number') {
    return money.format(value / 100);
  }
  if (key === 'vatRateBasisPoints' && typeof value === 'number') return `${new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 }).format(value / 100)} %`;
  if (key === 'allocated' && typeof value === 'boolean') return value ? 'Áno' : 'Nie';
  if (key === 'hasOwner' && typeof value === 'boolean') return value ? 'Áno' : 'Nie';
  if (key === 'method' && typeof value === 'string') return paymentMethodLabels[value] || value;
  if (key === 'reasonCode' && typeof value === 'string') return reasonLabels[value] || value;
  if (key === 'changedFields' && Array.isArray(value)) return value.map((item) => workItemValueLabels[String(item)] || String(item)).join(', ');
  if (typeof value === 'string' && workItemValueLabels[value]) return workItemValueLabels[value];
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function formatChanges(changes: Record<string, unknown>) {
  const entries = Object.entries(changes).filter(([key]) => key !== 'reason' || changes[key]);
  if (!entries.length) return 'Bez detailu';
  return entries.map(([key, value]) => `${changeLabels[key] || key}: ${formatChangeValue(key, value)}`).join(' · ');
}

export default async function AdminAuditPage() {
  await requireSuperAdmin();
  const logs = await listAuditLogs(300);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Bezpečnosť a dohľadateľnosť</p>
          <h1>Audit aktivít</h1>
        </div>
        <div className="admin-heading-meta">Posledných {logs.length} udalostí</div>
      </div>

      <section className="admin-card">
        <div className="admin-section-heading">
          <div><p>Nemenná história zmien</p><h2>Kto čo urobil</h2></div>
          <span className="admin-muted">Exporty, zmeny workflow, archivácia a administratívne zásahy</span>
        </div>
        <div className="admin-table-wrap" role="region" aria-label="Audit aktivít" tabIndex={0}>
          <table className="admin-table">
            <thead>
              <tr><th>Čas</th><th>Udalosť</th><th>Objekt</th><th>Vykonal</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(log.createdAt))}</td>
                  <td><strong>{actionLabels[log.action] || log.action}</strong></td>
                  <td>{entityLabels[log.entityType] || log.entityType}<br /><small>{log.entityId}</small></td>
                  <td>{log.actorEmail}</td>
                  <td><span className="admin-audit-detail">{formatChanges(log.changes)}</span></td>
                </tr>
              ))}
              {!logs.length ? <tr><td colSpan={5}>Zatiaľ nie sú uložené žiadne auditné udalosti.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
