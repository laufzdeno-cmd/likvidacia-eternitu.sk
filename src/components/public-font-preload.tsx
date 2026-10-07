"use client";

import { preload } from 'react-dom';

export function PublicFontPreload() {
  preload('/assets/fonts/plus-jakarta-sans-sk-wght-normal.woff2', {
    as: 'font',
    crossOrigin: 'anonymous',
    type: 'font/woff2',
  });
  return null;
}
