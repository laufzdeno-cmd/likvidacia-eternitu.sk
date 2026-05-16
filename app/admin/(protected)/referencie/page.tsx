import { listTestimonials } from '@/src/server/db';
import type { TestimonialStatus } from '@/src/server/types';
import { createTestimonialAction, updateTestimonialStatusAction } from './actions';

const statusLabels: Record<TestimonialStatus, string> = {
  draft: 'rozpracovaná',
  approved: 'schválená',
  hidden: 'skrytá',
};

export default async function TestimonialsPage() {
  const testimonials = await listTestimonials();

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Dôvera na webe</p>
          <h1>Referencie</h1>
        </div>
      </div>

      <section className="admin-card">
        <h2>Pridať referenciu</h2>
        <p>
          Na verejnom webe sa zobrazia iba referencie so stavom <strong>schválená</strong>. Používajte len texty, s ktorými
          zákazník súhlasil.
        </p>
        <form className="admin-quote-form" action={createTestimonialAction}>
          <label>
            Meno alebo iniciály
            <input name="customerName" placeholder="napr. Ján P." required />
          </label>
          <label>
            Lokalita
            <input name="location" placeholder="napr. Poprad / Prešovský kraj" />
          </label>
          <label>
            Email zákazníka (neverejný)
            <input name="customerEmail" type="email" placeholder="voliteľné" />
          </label>
          <label>
            Hodnotenie
            <select name="rating" defaultValue="5">
              <option value="5">5 hviezdičiek</option>
              <option value="4">4 hviezdičky</option>
              <option value="3">3 hviezdičky</option>
              <option value="2">2 hviezdičky</option>
              <option value="1">1 hviezdička</option>
            </select>
          </label>
          <label>
            Stav
            <select name="status" defaultValue="draft">
              <option value="draft">rozpracovaná</option>
              <option value="approved">schválená</option>
              <option value="hidden">skrytá</option>
            </select>
          </label>
          <label className="admin-form-wide">
            Text referencie
            <textarea name="text" rows={4} placeholder="Krátky, vecný text referencie..." required />
          </label>
          <label className="admin-checkbox admin-form-wide">
            <input name="consentPublication" type="checkbox" /> Zákazník súhlasil so zverejnením referencie.
          </label>
          <button className="admin-primary-button" type="submit">
            Uložiť referenciu
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Schvaľovanie</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dátum</th>
                <th>Zákazník</th>
                <th>Text</th>
                <th>Stav</th>
                <th>Akcie</th>
              </tr>
            </thead>
            <tbody>
              {testimonials.map((testimonial) => (
                <tr key={testimonial.id}>
                  <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(testimonial.createdAt))}</td>
                  <td>
                    <strong>{testimonial.customerName}</strong>
                    <br />
                    <small>
                      {testimonial.location || 'bez lokality'} · {testimonial.rating}/5 · {testimonial.source === 'public' ? 'poslané zákazníkom' : 'vložené adminom'}
                    </small>
                    {testimonial.customerEmail ? (
                      <>
                        <br />
                        <small>{testimonial.customerEmail}</small>
                      </>
                    ) : null}
                  </td>
                  <td>{testimonial.text}</td>
                  <td><span className="status-pill">{statusLabels[testimonial.status]}</span></td>
                  <td>
                    <div className="admin-action-row">
                      {(['approved', 'draft', 'hidden'] as TestimonialStatus[]).map((status) => (
                        <form key={status} action={updateTestimonialStatusAction}>
                          <input type="hidden" name="id" value={testimonial.id} />
                          <input type="hidden" name="status" value={status} />
                          <button type="submit" disabled={testimonial.status === status}>
                            {statusLabels[status]}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!testimonials.length ? <tr><td colSpan={5}>Zatiaľ nie sú pridané žiadne referencie.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
