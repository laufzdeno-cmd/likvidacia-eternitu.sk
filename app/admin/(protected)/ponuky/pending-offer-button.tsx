'use client';

import { useFormStatus } from 'react-dom';

type PendingOfferButtonProps = {
  idleText: string;
  pendingText: string;
};

export default function PendingOfferButton({ idleText, pendingText }: PendingOfferButtonProps) {
  const { pending } = useFormStatus();

  return (
    <div className="admin-submit-wrap">
      <button
        className={`admin-primary-button${pending ? ' is-submitting' : ''}`}
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <span className="admin-button-spinner" aria-hidden="true" />
            <span>Pracujem...</span>
          </>
        ) : (
          idleText
        )}
      </button>
      {pending ? <span className="admin-inline-pending" role="status" aria-live="polite">
        {pendingText}
      </span> : null}
    </div>
  );
}
