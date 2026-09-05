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
  review_request: 'Žiadosť o recenziu',
  testimonial: 'Referencia',
  realization: 'Realizácia',
  planner_action: 'Plánovač',
};

const actionLabels: Record<string, string> = {
  lead_created: 'Dopyt vytvorený',
  status_changed: 'Workflow zmenený',
  followup_scheduled: 'Follow-up naplánovaný',
  followup_cancelled: 'Follow-up zrušený',
  internal_note_changed: 'Interná poznámka zmenená',
  lead_archived: 'Dopyt archivovaný',
  lead_restored: 'Dopyt obnovený',
  lead_deleted: 'Dopyt trvalo odstránený',
  lead_file_deleted: 'Súbor odstránený',
  business_jobs_exported: 'Export zákaziek',
  analytics_exported: 'Export analytiky',
  business_job_created: 'Zákazka vytvorená',
  business_job_updated: 'Zákazka upravená',
  business_job_status_changed: 'Stav zákazky zmenený',
  quote_created: 'Ponuka vytvorená',
  quote_updated: 'Ponuka upravená',
  price_offer_email_sent: 'Ponuka odoslaná emailom',
  price_offer_email_error: 'Chyba odoslania ponuky',
  admin_user_created: 'Používateľ vytvorený',
  admin_user_updated: 'Používateľ upravený',
  admin_user_active_changed: 'Aktivita používateľa zmenená',
};

function formatChanges(changes: Record<string, unknown>) {
  const entries = Object.entries(changes).filter(([key]) => key !== 'reason' || changes[key]);
  if (!entries.length) return 'Bez detailu';
  return entries.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' · ');
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
        <div className="admin-table-wrap">
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
