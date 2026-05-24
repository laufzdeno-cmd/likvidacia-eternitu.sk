import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '../src/styles.css';
import '../src/premium-overrides.css';
import '../src/final-visual-polish.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://likvidacia-eternitu.sk'),
  title: 'Bezpečná likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
  description:
    'Zadajte približnú výmeru v m², lokalitu a typ materiálu. ASTANA pripraví cenovú ponuku, dokumentáciu, demontáž, balenie, odvoz a potvrdenie.',
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
    images: ['/assets/azbest/webp/azbest-087.webp'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bezpečná likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
    description: 'Cenová ponuka podľa približnej výmery v m², dokumentácia, demontáž, balenie, odvoz a potvrdenie.',
    images: ['/assets/azbest/webp/azbest-087.webp'],
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    'geo.region': 'SK',
    'geo.placename': 'Slovensko',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk" className={plusJakarta.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: 'ASTANA — Likvidácia azbestu a eternitu',
              description:
                'Bezpečná likvidácia azbestu a eternitu po celom Slovensku. Dokumentácia RÚVZ a OÚŽP, demontáž, balenie, odvoz a potvrdenie o legálnej likvidácii.',
              telephone: '+421905217946',
              email: 'astana@astana.sk',
              url: 'https://likvidacia-eternitu.sk',
              foundingDate: '2011',
              priceRange: '€€',
              currenciesAccepted: 'EUR',
              paymentAccepted: 'Hotovosť, Bankový prevod',
              areaServed: { '@type': 'Country', name: 'Slovakia' },
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
              sameAs: ['https://likvidacia-eternitu.sk'],
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Služby likvidácie azbestu',
                itemListElement: [
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'Likvidácia azbestovej strechy',
                      description: 'Stabilizácia, demontáž, balenie, odvoz a dokumentácia',
                    },
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'Dokumentácia RÚVZ a OÚŽP',
                      description: 'Kompletné vybavenie dokumentácie pre úrady',
                    },
                  },
                ],
              },
            }),
          }}
        />
      </head>
      <body className={plusJakarta.className}>{children}</body>
    </html>
  );
}
