import type { ApplicationNotification, ApplicationNotificationEntity } from '@/src/server/types';
import { resolveApplicationNotificationUnknownAction, retryConfirmedApplicationNotificationAction } from './actions';

const statusLabels: Record<ApplicationNotification['status'], string> = {
  pending: 'čaká na odoslanie',
  sending: 'odosielanie prebieha',
  sent: 'odoslanie technicky potvrdené',
  failed: 'odoslanie zlyhalo',
  unknown: 'výsledok nie je známy',
  confirmed_delivered: 'doručenie overené obsluhou',
  confirmed_not_delivered: 'nedoručenie overené obsluhou',
};

export default function NotificationStatuses({
  notifications,
  entityType,
  csrfToken,
}: {
  notifications: ApplicationNotification[];
  entityType: ApplicationNotificationEntity;
  csrfToken: string;
}) {
  if (!notifications.length) {
    return <span className="admin-warning-badge">Stav sa neeviduje. Pred opakovaným odoslaním najprv skontrolujte schránku.</span>;
  }

  return <div className="admin-form-stack">
    {notifications.map((notification) => {
      const needsMailboxCheck = notification.status === 'unknown' || notification.status === 'failed' || notification.status === 'pending';
      const canResolveManually = notification.status === 'unknown' || (notification.status === 'failed' && !notification.retryable);
      return <div key={notification.recipient}>
        <strong>{notification.recipient === 'applicant' ? 'Uchádzač / strechár' : 'ASTANA'}:</strong>{' '}
        <span className={needsMailboxCheck ? 'admin-warning-badge' : undefined}>{statusLabels[notification.status]}</span>
        {canResolveManually ? <form action={resolveApplicationNotificationUnknownAction} className="admin-quote-form admin-notification-resolution-form">
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={notification.entityId} />
          <input type="hidden" name="recipient" value={notification.recipient} />
          <label>
            Výsledok po kontrole schránky a záznamu poskytovateľa
            <select name="resolution" required defaultValue="">
              <option value="" disabled>Vyberte overený výsledok</option>
              {notification.status === 'unknown' ? <option value="delivered">Doručenie je potvrdené</option> : null}
              <option value="not_delivered">Poskytovateľ potvrdil, že sa neodoslal</option>
            </select>
          </label>
          <label>
            Typ dôkazu (do auditu sa uloží iba bezpečný kód)
            <select name="evidence" required defaultValue="">
              <option value="" disabled>Vyberte dôkaz zodpovedajúci výsledku</option>
              <option value="inbox_message_found">V schránke sa našla správa</option>
              <option value="provider_rejected">Poskytovateľ potvrdil odmietnutie</option>
            </select>
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" name="checkedEvidence" value="yes" required />
            Overil(a) som schránku aj záznam poskytovateľa; tento krok nič neposiela.
          </label>
          <button type="submit">Uložiť overený výsledok</button>
        </form> : null}
        {notification.status === 'confirmed_not_delivered'
          ? <RetryForm entityType={entityType} entityId={notification.entityId} recipient={notification.recipient} csrfToken={csrfToken} />
          : null}
        {needsMailboxCheck && !canResolveManually ? <small>Pred prípadným opakovaným odoslaním najprv skontrolujte schránku.</small> : null}
      </div>;
    })}
  </div>;
}

function RetryForm({
  entityType,
  entityId,
  recipient,
  csrfToken,
}: {
  entityType: ApplicationNotificationEntity;
  entityId: string;
  recipient: ApplicationNotification['recipient'];
  csrfToken: string;
}) {
  return <form action={retryConfirmedApplicationNotificationAction} className="admin-notification-resolution-form">
    <input type="hidden" name="_csrf" value={csrfToken} />
    <input type="hidden" name="entityType" value={entityType} />
    <input type="hidden" name="entityId" value={entityId} />
    <input type="hidden" name="recipient" value={recipient} />
    <p>Týmto sa odošle nový email iba vybranému príjemcovi.</p>
    <label className="admin-checkbox">
      <input type="checkbox" name="confirmedNonDelivery" value="yes" required />
      Potvrdzujem, že schránka aj záznam poskytovateľa dokazujú nedoručenie.
    </label>
    <button type="submit">Znova odoslať tento email</button>
  </form>;
}
