import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { site } from '@/src/content/site';
import { buildOrganizationJsonLd } from './seo-json-ld';
import { MeasurementConsent } from './measurement';
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

const googleAdsConversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID?.trim() || '';

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
        <Script id="astana-consent-default" strategy="beforeInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', { analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', wait_for_update:500 });
        `}</Script>
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
        <MeasurementConsent />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-LZQ9JJRGNR" strategy="afterInteractive" />
        <Script id="astana-google-measurement" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){dataLayer.push(arguments);};
          gtag('js', new Date());
          gtag('config', 'G-LZQ9JJRGNR', { linker:{ domains:['astana.sk','likvidacia-eternitu.sk','likvidovanie-azbestu.sk'] } });
          ${googleAdsConversionId ? `gtag('config', ${JSON.stringify(googleAdsConversionId)});` : ''}
        `}</Script>
      </body>
    </html>
  );
}
