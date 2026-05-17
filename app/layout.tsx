import type { Metadata } from 'next';
import '../src/styles.css';
import '../src/premium-overrides.css';
import '../src/final-visual-polish.css';

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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}
