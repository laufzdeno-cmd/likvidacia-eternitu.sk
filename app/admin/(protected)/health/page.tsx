import { getSystemHealth } from '@/src/server/db';
import { requireSuperAdmin } from '@/src/server/auth';

function healthClass(ok: boolean) {
  return ok ? 'health-ok' : 'health-warn';
}

function featureClass(level: 'ok' | 'warning' | 'disabled') {
  if (level === 'ok') return 'health-ok';
  if (level === 'warning') return 'health-caution';
  return 'health-warn';
}

export default async function AdminHealthPage() {
  await requireSuperAdmin();
  const health = await getSystemHealth();

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Produkčná kontrola</p>
          <h1>Kontrola systému</h1>
        </div>
      </div>

      <section className="admin-stat-grid health-grid">
        <article className={health.leadMail.level === 'ok' ? 'health-ok' : health.leadMail.level === 'warning' ? 'health-caution' : 'health-warn'}>
          <span>Dopytové emaily</span>
          <strong>{health.leadMail.label}</strong>
          <small>{health.leadMail.detail}</small>
        </article>
        <article className={healthClass(health.database.ok)}>
          <span>Databáza</span>
          <strong>{health.database.ok ? 'OK' : 'Pozor'}</strong>
          <small>{health.database.detail}</small>
        </article>
        <article className={healthClass(health.storage.ok)}>
          <span>Storage</span>
          <strong>{health.storage.ok ? 'OK' : 'Pozor'}</strong>
          <small>{health.storage.detail}</small>
        </article>
        <article className={healthClass(health.smtp.ok)}>
          <span>SMTP spojenie</span>
          <strong>{health.smtp.ok ? 'Odpovedá' : 'Neoverené'}</strong>
          <small>{health.smtp.detail}</small>
        </article>
        <article>
          <span>Build commit</span>
          <strong>{health.buildCommit.slice(0, 8)}</strong>
          <small>{health.buildCommit}</small>
        </article>
      </section>

      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <p>Bez zobrazenia hesiel a tokenov</p>
            <h2>Pripravenosť produkčných funkcií</h2>
          </div>
        </div>
        <div className="admin-stat-grid health-grid">
          <article className={featureClass(health.features.conversion.level)}>
            <span>Serverové meranie dopytov</span>
            <strong>{health.features.conversion.label}</strong>
            <small>{health.features.conversion.detail}</small>
          </article>
          <article className={featureClass(health.features.routeDistance.level)}>
            <span>Automatické kilometre v ponuke</span>
            <strong>{health.features.routeDistance.label}</strong>
            <small>{health.features.routeDistance.detail}</small>
          </article>
          <article className={featureClass(health.features.leadRetention.level)}>
            <span>Retencia fotografií dopytu</span>
            <strong>{health.features.leadRetention.label}</strong>
            <small>{health.features.leadRetention.detail}</small>
          </article>
          <article className={featureClass(health.features.careerRetention.level)}>
            <span>Retencia životopisov</span>
            <strong>{health.features.careerRetention.label}</strong>
            <small>{health.features.careerRetention.detail}</small>
          </article>
          <article className={featureClass(health.features.photoIntake.level)}>
            <span>Tímový príjem fotografií</span>
            <strong>{health.features.photoIntake.label}</strong>
            <small>{health.features.photoIntake.detail}</small>
          </article>
          <article className={featureClass(health.features.operationsAlert.level)}>
            <span>Upozornenia na doručovanie</span>
            <strong>{health.features.operationsAlert.label}</strong>
            <small>{health.features.operationsAlert.detail}</small>
          </article>
        </div>
      </section>

      <section className="admin-card">
        <h2>Doména a originy</h2>
        <dl className="admin-dl wide">
          <dt>NEXT_PUBLIC_SITE_URL</dt>
          <dd>{health.siteUrl}</dd>
          <dt>ALLOWED_ORIGINS</dt>
          <dd>{health.allowedOrigins}</dd>
          <dt>Primárna doména</dt>
          <dd>https://likvidacia-eternitu.sk</dd>
        </dl>
      </section>

      <section className="admin-card">
        <h2>Posledné udalosti</h2>
        <dl className="admin-dl wide">
          <dt>Posledný dopyt</dt>
          <dd>
            {health.lastLead
              ? `${health.lastLead.fullName} · ${health.lastLead.city} · ${new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(health.lastLead.createdAt))}`
              : 'Zatiaľ žiadny dopyt.'}
          </dd>
          <dt>Posledný úspešný email</dt>
          <dd>
            {health.lastEmailSent
              ? `${health.lastEmailSent.entityId.slice(0, 8)} · ${new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(health.lastEmailSent.createdAt))}`
              : 'Zatiaľ bez úspešne odoslaného emailu.'}
          </dd>
          <dt>Posledná zaznamenaná chyba e-mailu (historická)</dt>
          <dd>
            {health.lastEmailError
              ? `${health.lastEmailError.action} · ${new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(health.lastEmailError.createdAt))}`
              : 'Bez evidovanej chyby.'}
          </dd>
        </dl>
      </section>
    </main>
  );
}
