import { listTestimonials } from '@/src/server/db';
import type { TestimonialStatus } from '@/src/server/types';
import { createTestimonialAction, updateTestimonialStatusAction } from './actions';

const statusLabels: Record<TestimonialStatus, string> = {
  draft: 'rozpracovaná',
  approved: 'schválená',
  hidden: 'skrytá',
};

const objectTypes = ['Rodinný dom', 'Hospodárska budova', 'Garáž', 'Priemyselný objekt'];

export default async function ReviewsAdminPage() {
  const testimonials = await listTestimonials();

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Recenzie spravuje iba admin</p>
          <h1>Recenzie</h1>
        </div>
      </div>

      <section className="admin-card">
        <h2>Pridať recenziu</h2>
        <form className="admin-quote-form" action={createTestimonialAction}>
          <label>
            Meno a priezvisko
            <input name="customerName" placeholder="napr. Martin H." required />
          </label>
          <label>
            Lokalita
            <input name="location" placeholder="napr. Košice" required />
          </label>
          <label>
            Typ objektu
            <select name="objectType" defaultValue="Rodinný dom">
              {objectTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Dátum realizácie
            <input name="realizationDate" type="date" />
          </label>
          <label>
            Hviezdičky
            <select name="rating" defaultValue="5">
              {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
            </select>
          </label>
          <label>
            Zdroj
            <select name="source" defaultValue="Google">
              {['Google', 'Telefón', 'WhatsApp', 'Email', 'Osobne'].map((source) => <option key={source}>{source}</option>)}
            </select>
          </label>
          <label className="admin-form-wide">
            Text recenzie
            <textarea name="text" rows={4} required />
          </label>
          <label className="admin-form-wide">
            Foto URL (voliteľné)
            <input name="photoUrl" placeholder="/assets/..." />
          </label>
          <label className="admin-form-wide">
            Interná poznámka
            <textarea name="internalNote" rows={3} />
          </label>
          <input type="hidden" name="status" value="draft" />
          <input type="hidden" name="consentPublication" value="on" />
          <button className="admin-primary-button" type="submit">Pridať recenziu</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Zoznam recenzií</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Zákazník</th><th>Recenzia</th><th>Stav</th><th>Akcie</th></tr></thead>
            <tbody>
              {testimonials.map((review) => (
                <tr key={review.id}>
                  <td>
                    <strong>{review.customerName}</strong>
                    <br />
                    <small>{review.location || 'bez lokality'} · {review.objectType || 'typ neuvedený'} · {review.rating}/5</small>
                  </td>
                  <td>
                    {review.text}
                    {review.internalNote ? <><br /><small>Interné: {review.internalNote}</small></> : null}
                  </td>
                  <td><span className="status-pill">{statusLabels[review.status]}</span></td>
                  <td>
                    <div className="admin-action-row">
                      {(['approved', 'hidden', 'draft'] as TestimonialStatus[]).map((status) => (
                        <form key={status} action={updateTestimonialStatusAction}>
                          <input type="hidden" name="id" value={review.id} />
                          <input type="hidden" name="status" value={status} />
                          <button type="submit" disabled={review.status === status}>{statusLabels[status]}</button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!testimonials.length ? <tr><td colSpan={4}>Zatiaľ nie sú pridané žiadne recenzie.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
