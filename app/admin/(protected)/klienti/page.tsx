import { requireAdminUser } from '@/src/server/auth';
import { listCustomerDirectory } from '@/src/server/db';

function directoryHref(page: number) {
  return page > 1 ? `/admin/klienti?page=${page}` : '/admin/klienti';
}

function contactLine(email: string, phone: string, location: string) {
  return [phone, email, location].filter(Boolean).join(' · ') || 'Kontaktné údaje nie sú kompletné';
}

export default async function CustomerDirectoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminUser();
  const params = await searchParams;
  const requestedPage = Number(params.page);
  const result = await listCustomerDirectory({ page: Number.isInteger(requestedPage) ? requestedPage : 1, pageSize: 40 });

  return <main className="admin-page intelligence-page">
    <header className="intelligence-hero">
      <div>
        <p>Prepojený pohľad bez kopírovania údajov</p>
        <h1>Klienti</h1>
        <span>Opakované dopyty, zákazky a ponuky sú zoskupené podľa zhodného emailu alebo telefónu. Systém nič automaticky nespája ani nemaže.</span>
      </div>
      <a className="admin-secondary-link" href="/admin/vyhladavanie">Vyhľadať konkrétneho klienta</a>
    </header>

    {result.truncated ? <p className="work-notice is-warning" role="status">Prehľad dosiahol bezpečnostný limit veľkého archívu. Na staršie záznamy použite globálne vyhľadávanie.</p> : null}
    <section className="admin-stat-grid" aria-label="Súhrn adresára">
      <article><span>Klienti v prehľade</span><strong>{result.total}</strong></article>
      <article><span>Aktuálna strana</span><strong>{result.page}/{result.totalPages}</strong></article>
    </section>

    <div className="customer-directory-grid">
      {result.items.map((customer) => <article className="admin-card customer-directory-card" key={customer.key}>
        <header>
          <div><p>Klient</p><h2>{customer.name}</h2></div>
          <span>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(customer.latestActivityAt))}</span>
        </header>
        <p className="admin-muted">{contactLine(customer.email, customer.phone, customer.location)}</p>
        <div className="customer-directory-counts" aria-label="Počet súvisiacich záznamov">
          <span>Dopyty <strong>{customer.inquiries.length}</strong></span>
          <span>Zákazky <strong>{customer.jobs.length}</strong></span>
          <span>Ponuky <strong>{customer.offers.length}</strong></span>
        </div>
        <div className="customer-directory-links">
          {[...customer.inquiries, ...customer.jobs, ...customer.offers].slice(0, 6).map((record) => <a href={record.href} key={`${record.href}:${record.id}`}>
            <span>{record.label}</span>
            <small>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short' }).format(new Date(record.activityAt))}</small>
          </a>)}
          {customer.inquiries.length + customer.jobs.length + customer.offers.length > 6
            ? <small className="admin-muted">Ďalšie záznamy nájdete cez globálne vyhľadávanie.</small>
            : null}
        </div>
      </article>)}
      {!result.items.length ? <section className="work-empty"><h2>Zatiaľ nie sú evidovaní klienti</h2><p>Adresár sa vytvorí automaticky z reálnych dopytov, zákaziek a ponúk.</p></section> : null}
    </div>

    {result.totalPages > 1 ? <nav className="admin-pagination" aria-label="Stránkovanie klientov">
      <span>Zobrazené {(result.page - 1) * result.pageSize + 1}–{Math.min(result.page * result.pageSize, result.total)} z {result.total}</span>
      {result.page > 1 ? <a href={directoryHref(result.page - 1)}>Novší klienti</a> : null}
      <span>Strana {result.page} z {result.totalPages}</span>
      {result.page < result.totalPages ? <a href={directoryHref(result.page + 1)}>Starší klienti</a> : null}
    </nav> : null}
  </main>;
}
