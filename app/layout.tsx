import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
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
  metadataBase: new URL('https://likvidacia-eternitu.sk'),
  title: 'Bezpečná likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
  description:
    'Zadajte výmeru v m² a získajte cenovú ponuku do 24 hodín. ASTANA od roku 2011 - dokumentácia RÚVZ, demontáž, balenie, odvoz, doklady. Celé Slovensko.',
  keywords: 'likvidácia azbestu, odstránenie eternitu, azbest strecha, cena likvidácia azbest, RÚVZ dokumentácia, nebezpečný odpad',
  authors: [{ name: 'ASTANA, s.r.o.' }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'sk_SK',
    url: '/',
    siteName: 'Likvidácia azbestu a eternitu ASTANA',
    title: 'Bezpečná likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
    description:
      'Vy riešite výmeru. My riešime zvyšok: dokumentáciu, demontáž, balenie, odvoz a potvrdenie o legálnej likvidácii.',
    images: ['/og/homepage.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bezpečná likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
    description: 'Cenová ponuka podľa približnej výmery v m², dokumentácia, demontáž, balenie, odvoz a potvrdenie.',
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
    author: 'ASTANA, s.r.o.',
  },
};

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'ASTANA - Likvidácia azbestu a eternitu',
  description:
    'Bezpečná likvidácia azbestu a eternitu po celom Slovensku. Dokumentácia RÚVZ a OÚ ŽP, demontáž, balenie, odvoz a potvrdenie.',
  url: 'https://likvidacia-eternitu.sk',
  telephone: '+421905217946',
  email: 'astana@astana.sk',
  foundingDate: '2011',
  priceRange: '€€',
  knowsAbout: ['Likvidácia azbestu', 'Eternit', 'Nebezpečný odpad', 'RÚVZ dokumentácia', 'Demontáž eternitu'],
  areaServed: { '@type': 'Country', name: 'Slovakia', sameAs: 'https://www.wikidata.org/wiki/Q214' },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Likvidácia azbestu a eternitu',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Likvidácia vlnitého eternitu',
          description: 'Stabilizácia, demontáž, balenie a odvoz vlnitého eternitu vrátane dokumentácie RÚVZ a OÚ ŽP',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Likvidácia hladkého eternitu',
          description: 'Likvidácia hladkého a štvorcového eternitu vrátane kompletnej dokumentácie',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Dokumentácia RÚVZ a OÚ ŽP',
          description: 'Vypracovanie všetkej potrebnej dokumentácie pre úrady',
        },
      },
    ],
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Scherffelova 1364/28',
    addressLocality: 'Poprad',
    postalCode: '05801',
    addressCountry: 'SK',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '07:00',
      closes: '18:00',
    },
  ],
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ASTANA, s.r.o.',
  url: 'https://likvidacia-eternitu.sk',
  email: 'astana@astana.sk',
  telephone: '+421905217946',
  address: localBusinessJsonLd.address,
  logo: 'https://likvidacia-eternitu.sk/assets/astana-logo.svg',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Likvidácia eternitu a azbestu ASTANA',
  url: 'https://likvidacia-eternitu.sk',
  inLanguage: 'sk-SK',
  publisher: {
    '@type': 'Organization',
    name: 'ASTANA, s.r.o.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk" className={plusJakarta.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0F1F3D" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([localBusinessJsonLd, organizationJsonLd, websiteJsonLd]) }}
        />
      </head>
      <body className={plusJakarta.className}>
        {children}
      </body>
    </html>
  );
}
