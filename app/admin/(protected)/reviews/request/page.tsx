import { listReviewRequests } from '@/src/server/db';
import { createReviewRequestAction, getStoredGoogleReviewLink, updateReviewRequestStatusAction } from './actions';
import ReviewRequestTools from './review-request-tools';
import type { ReviewRequestStatus } from '@/src/server/types';

const statusLabels: Record<ReviewRequestStatus, string> = {
  sent: 'odoslaná',
  review_received: 'recenzia prijatá',
};

export default async function ReviewRequestPage() {
  const [requests, googleLink] = await Promise.all([listReviewRequests(), getStoredGoogleReviewLink()]);

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Google hodnotenia</p>
          <h1>Žiadosť o recenziu</h1>
        </div>
      </div>

      <section className="admin-card">
        <h2>Vygenerovať WhatsApp správu</h2>
        <p>Google odkaz sa po uložení zapamätá ako konfigurácia pre ďalšie žiadosti.</p>
        <form action={createReviewRequestAction}>
          <ReviewRequestTools defaultLink={googleLink} />
          <button className="admin-primary-button" type="submit">
            Uložiť do histórie
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>História odoslaných žiadostí</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Meno</th>
                <th>Lokalita</th>
                <th>Dátum žiadosti</th>
                <th>Stav</th>
                <th>Akcia</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.customerName}</strong>
                    <br />
                    <small>{request.phone}</small>
                  </td>
                  <td>{request.location || 'bez lokality'}</td>
                  <td>{new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.createdAt))}</td>
                  <td><span className="status-pill">{statusLabels[request.status]}</span></td>
                  <td>
                    <div className="admin-action-row">
                      {(['sent', 'review_received'] as ReviewRequestStatus[]).map((status) => (
                        <form key={status} action={updateReviewRequestStatusAction}>
                          <input type="hidden" name="id" value={request.id} />
                          <input type="hidden" name="status" value={status} />
                          <button type="submit" disabled={request.status === status}>{statusLabels[status]}</button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!requests.length ? <tr><td colSpan={5}>Zatiaľ nie je odoslaná žiadna žiadosť o recenziu.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
