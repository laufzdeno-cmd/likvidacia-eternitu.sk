'use client';

import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import type { MouseEvent } from 'react';

type PendingOfferButtonProps = {
  idleText: string;
  pendingText: string;
};

export default function PendingOfferButton({ idleText, pendingText }: PendingOfferButtonProps) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const isPending = pending || clicked;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setClicked(true);

    const button = event.currentTarget;
    const wrap = button.closest('.admin-submit-wrap');
    button.classList.add('is-submitting');
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<span class="admin-button-spinner" aria-hidden="true"></span><span>Pracujem...</span>';

    if (wrap && !wrap.querySelector('.admin-inline-pending')) {
      const note = document.createElement('span');
      note.className = 'admin-inline-pending';
      note.setAttribute('role', 'status');
      note.setAttribute('aria-live', 'polite');
      const spinner = document.createElement('span');
      spinner.className = 'admin-button-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      note.append(spinner, pendingText);
      wrap.appendChild(note);
    }

    window.setTimeout(() => {
      button.disabled = true;
    }, 0);
  };

  return (
    <div className="admin-submit-wrap">
      <button
        className="admin-primary-button"
        type="submit"
        disabled={pending}
        aria-busy={isPending}
        onClick={handleClick}
      >
        {isPending ? (
          <>
            <span className="admin-button-spinner" aria-hidden="true" />
            <span>Pracujem...</span>
          </>
        ) : (
          idleText
        )}
      </button>
    </div>
  );
}
