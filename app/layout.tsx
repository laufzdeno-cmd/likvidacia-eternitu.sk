import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { site } from '@/src/content/site';
import { buildOrganizationJsonLd } from './seo-json-ld';
import '../src/styles.css';
import '../src/premium-overrides.css';
import '../src/final-visual-polish.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.website),
  title: 'Likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
  description:
    'Odborná likvidácia azbestu a eternitu vrátane cenovej ponuky, dokumentácie, bezpečnej demontáže, balenia, odvozu a potvrdenia o legálnej likvidácii.',
  keywords: 'likvidácia azbestu, likvidácia eternitu, odstránenie azbestu, cena likvidácie azbestu, nebezpečný odpad',
  authors: [{ name: site.legalName }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'sk_SK',
    url: '/',
    siteName: 'Likvidácia azbestu a eternitu ASTANA',
    title: 'Likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
    description:
      'ASTANA zabezpečuje dokumentáciu, demontáž, balenie, odvoz a potvrdenie o legálnej likvidácii.',
    images: ['/og/homepage.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
    description: 'Cenová ponuka podľa výmery, lokality a typu materiálu. Dokumentácia, demontáž, balenie, odvoz a potvrdenie.',
    images: ['/og/homepage.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    'geo.region': 'SK',
    'geo.placename': 'Slovensko',
    'geo.position': '48.9;19.5',
    ICBM: '48.9, 19.5',
    author: site.legalName,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk" className={plusJakarta.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0F1F3D" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd()) }}
        />
      </head>
      <body className={plusJakarta.className}>
        {children}
      </body>
    </html>
  );
}
