import type { Metadata } from 'next';
import { serviceDocumentationOutcome, site } from '@/src/content/site';
import { serializeJsonLd } from '@/src/lib/json-ld-serialize.mjs';
import { buildOrganizationJsonLd } from './seo-json-ld';
import '../src/global-bundle.css';
import './editorial-pages.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.website),
  title: 'Likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
  description:
    `Odborná likvidácia azbestu a eternitu po celom Slovensku. ASTANA zabezpečí dokumentáciu, demontáž, balenie, odvoz a ${serviceDocumentationOutcome}.`,
  keywords: 'likvidácia azbestu, likvidácia eternitu, odstránenie azbestu, cena likvidácie azbestu, nebezpečný odpad',
  authors: [{ name: site.legalName }],
  openGraph: {
    type: 'website',
    locale: 'sk_SK',
    url: '/',
    siteName: 'Likvidácia azbestu a eternitu ASTANA',
    title: 'Likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
    description:
      `ASTANA zabezpečuje dokumentáciu, demontáž, balenie, odvoz a ${serviceDocumentationOutcome}.`,
    images: ['/og/homepage.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
    description: 'Cenová ponuka podľa výmery, lokality a typu materiálu. Dokumentácia, demontáž, balenie, odvoz a dohodnuté doklady.',
    images: ['/og/homepage.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    author: site.legalName,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0F1F3D" />
        <meta name="color-scheme" content="only light" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildOrganizationJsonLd()) }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
