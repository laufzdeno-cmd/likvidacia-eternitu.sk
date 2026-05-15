import type { Metadata } from 'next';
import '../src/styles.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://likvidacia-eternitu.sk'),
  title: 'Bezpečná likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
  description:
    'Zadajte približnú výmeru v m² a priložte fotky. ASTANA pripraví cenovú ponuku do 24 hodín, dokumentáciu, demontáž, balenie, odvoz a potvrdenie.',
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
      'Zadajte približnú výmeru v m² a priložte fotky. Pripravíme cenovú ponuku, dokumentáciu, demontáž, balenie, odvoz a potvrdenie.',
    images: ['/assets/hero-workers.webp'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bezpečná likvidácia azbestu a eternitu po celom Slovensku | ASTANA',
    description: 'Cenová ponuka do 24 hodín podľa približnej výmery v m², dokumentácia, demontáž, balenie, odvoz a potvrdenie.',
    images: ['/assets/hero-workers.webp'],
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
