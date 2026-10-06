'use client';

import { useEffect, useRef } from 'react';

const stylesheet = '/assets/home-below-fold.css';

export default function HomeDeferredStyles() {
  const linkRef = useRef<HTMLLinkElement>(null);
  useEffect(() => {
    if (linkRef.current) linkRef.current.media = 'all';
  }, []);

  return (
    <>
      <link ref={linkRef} rel="stylesheet" href={stylesheet} media="print" />
      <noscript><link rel="stylesheet" href={stylesheet} /></noscript>
    </>
  );
}
