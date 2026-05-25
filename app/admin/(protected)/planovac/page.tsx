import { listBusinessJobs, listPlannerActions, listWorkers } from '@/src/server/db';
import { savePlannerActionAction } from './actions';
import PrintButton from './print-button';

const typeLabels = {
  DEMONTAZ: 'Demontáž',
  ODVOZ: 'Odvoz',
  DOKUMENTACIA: 'Dokumentácia',
  INE: 'Iné',
};

const statusLabels = {
  NAPLANOVANA: 'Naplánovaná',
  DOKONCENA: 'Dokončená',
  ZRUSENA: 'Zrušená',
  PRESUNUTA: 'Presunutá',
};

function monthMeta(month?: string) {
  const base = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T00:00:00`) : new Date();
  const year = base.getFullYear();
  const index = base.getMonth();
  const first = new Date(year, index, 1);
  const last = new Date(year, index + 1, 0);
  const from = new Date(year, index, 1 - ((first.getDay() + 6) % 7));
  const to = new Date(year, index, last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const prev = new Date(year, index - 1, 1).toISOString().slice(0, 7);
  const next = new Date(year, index + 1, 1).toISOString().slice(0, 7);
  return { year, index, key: `${year}-${String(index + 1).padStart(2, '0')}`, from, to, prev, next, title: base.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' }) };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function weatherFor(address: string, date: string) {
  if (!address) return null;
  try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${address}, Slovensko`)}`, {
      headers: { 'User-Agent': 'ASTANA admin planner' },
      next: { revalidate: 60 * 60 * 12 },
    });
    const geo = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
    if (!geo[0]) return null;
    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo[0].lat}&longitude=${geo[0].lon}&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max&timezone=Europe%2FBratislava&start_date=${date}&end_date=${date}`,
      { next: { revalidate: 60 * 60 * 6 } },
    );
    const data = await forecastRes.json() as { daily?: { temperature_2m_max?: number[]; precipitation_sum?: number[]; wind_speed_10m_max?: number[] } };
    const temp = data.daily?.temperature_2m_max?.[0];
    const rain = data.daily?.precipitation_sum?.[0] ?? 0;
    const wind = data.daily?.wind_speed_10m_max?.[0] ?? 0;
    return { temp, rain, wind, warning: rain > 2 || wind > 35 };
  } catch {
    return null;
  }
}

export default async function PlannerPage({ searchParams }: { searchParams?: Promise<{ mesiac?: string }> }) {
  const params = await searchParams;
  const meta = monthMeta(params?.mesiac);
  const [actions, workers, jobs] = await Promise.all([
    listPlannerActions({ from: dateKey(meta.from), to: dateKey(meta.to) }),
    listWorkers(true),
    listBusinessJobs(),
  ]);
  const days = Array.from({ length: Math.round((meta.to.getTime() - meta.from.getTime()) / 86400000) + 1 }, (_, index) => {
    const date = new Date(meta.from);
    date.setDate(meta.from.getDate() + index);
    return date;
  });
  const selectedWeather = actions[0] ? await weatherFor(actions[0].address, actions[0].date) : null;

  return (
    <main className="admin-page planner-page">
      <div className="print-report-heading"><img src="/assets/astana-logo.svg" alt="ASTANA" /><p>ASTANA — Plán akcií {meta.title}</p></div>
      <div className="admin-heading">
        <div><p>Termíny a terén</p><h1>Plánovač</h1></div>
        <div className="admin-action-row no-print">
          <a className="admin-secondary-link" href={`/admin/planovac?mesiac=${meta.prev}`}>‹ Predchádzajúci</a>
          <a className="admin-secondary-link" href={`/admin/planovac?mesiac=${meta.next}`}>Ďalší ›</a>
          <PrintButton />
        </div>
      </div>

      <section className="admin-card no-print">
        <h2>Nová akcia</h2>
        <form className="admin-quote-form" action={savePlannerActionAction}>
          <label>Dátum<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label>Čas od<input name="timeFrom" defaultValue="06:00" /></label>
          <label>Čas do<input name="timeTo" defaultValue="14:00" /></label>
          <label>Typ<select name="type" defaultValue="DEMONTAZ">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="admin-form-wide">Adresa<input name="address" required placeholder="Obec, ulica alebo presná adresa" /></label>
          <label>Zákazka<select name="jobId"><option value="">Bez prepojenia</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.customerName} · {job.location}</option>)}</select></label>
          <label>Stav<select name="status" defaultValue="NAPLANOVANA">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="admin-form-wide planner-workers">
            <span>Pracovníci</span>
            {workers.map((worker) => <label className="admin-checkbox" key={worker.id}><input name="workers" type="checkbox" value={worker.name} /> {worker.name}</label>)}
          </div>
          <label>Meno zákazníka<input name="customerName" /></label>
          <label>Email zákazníka<input name="customerEmail" type="email" /></label>
          <label>Telefón zákazníka<input name="customerPhone" /></label>
          <label className="admin-form-wide">Poznámka<textarea name="note" rows={3} /></label>
          <div className="admin-form-wide planner-weather">
            <strong>Počasie</strong>
            <span>{selectedWeather ? `${selectedWeather.warning ? '⚠ Nevhodné počasie' : '✓ Počasie vyzerá v poriadku'} · ${selectedWeather.temp ?? '—'} °C · dážď ${selectedWeather.rain} mm · vietor ${selectedWeather.wind} km/h` : 'Po uložení akcie sa počasie zobrazí pri najbližšom prehľade.'}</span>
          </div>
          <div className="admin-form-wide planner-notifications">
            <strong>Notifikácie</strong>
            <label className="admin-checkbox"><input name="notify2Days" type="checkbox" /> Upozorniť nás 2 dni pred</label>
            <label className="admin-checkbox"><input name="notify1Day" type="checkbox" /> Upozorniť nás deň pred</label>
            <label className="admin-checkbox"><input name="notifyCustomer" type="checkbox" /> Odoslať email zákazníkovi 2 dni pred</label>
          </div>
          <button className="admin-primary-button admin-form-wide" type="submit">Uložiť akciu</button>
        </form>
      </section>

      <section className="admin-card planner-calendar no-print">
        <h2>{meta.title}</h2>
        <div className="planner-grid planner-weekdays">{['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map((day) => <strong key={day}>{day}</strong>)}</div>
        <div className="planner-grid">
          {days.map((day) => {
            const key = dateKey(day);
            const dayActions = actions.filter((action) => action.date === key);
            return (
              <article className={day.getMonth() === meta.index ? '' : 'is-muted'} key={key}>
                <span>{day.getDate()}</span>
                {dayActions.map((action) => (
                  <div className={`planner-event is-${action.type.toLowerCase()}`} key={action.id}>
                    <b>{action.timeFrom}</b> {typeLabels[action.type]}<br />
                    <small>{action.address}</small>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      </section>

      <section className="admin-card planner-print-list">
        <h2>Zoznam akcií</h2>
        <table className="admin-table">
          <thead><tr><th>Dátum</th><th>Čas</th><th>Adresa</th><th>Tím</th><th>Typ</th><th>Stav</th></tr></thead>
          <tbody>
            {actions.map((action) => <tr key={action.id}><td>{action.date}</td><td>{action.timeFrom} – {action.timeTo}</td><td>{action.address}</td><td>{action.workers || '—'}</td><td>{typeLabels[action.type]}</td><td>{statusLabels[action.status]}</td></tr>)}
            {!actions.length ? <tr><td colSpan={6}>V tomto mesiaci nie sú naplánované žiadne akcie.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
