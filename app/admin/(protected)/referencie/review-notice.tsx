'use client';

import { useEffect, useRef } from 'react';

export default function ReviewNotice({ message, isError }: { message: string; isError: boolean }) {
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    noticeRef.current?.focus({ preventScroll: true });
  }, [message]);

  return <p
    ref={noticeRef}
    className="review-notice"
    role={isError ? 'alert' : 'status'}
    aria-live={isError ? 'assertive' : 'polite'}
    aria-atomic="true"
    tabIndex={-1}
  >{message}</p>;
}
