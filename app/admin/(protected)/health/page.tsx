import { getSystemHealth } from '@/src/server/db';

function healthClass(ok: boolean) {
  return ok ? 'health-ok' : 'health-warn';
}

export default async function AdminHealthPage() {
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
          <span>SMTP</span>
          <strong>{health.smtp.ok ? 'OK' : 'Chýba'}</strong>
          <small>{health.smtp.detail}</small>
        </article>
        <article>
          <span>Build commit</span>
          <strong>{health.buildCommit.slice(0, 8)}</strong>
          <small>{health.buildCommit}</small>
        </article>
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
          <dt>Posledný email error/skip</dt>
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
