import type { Metadata } from 'next';
import '../src/styles.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://likvidacia-eternitu.sk'),
  title: 'Likvidácia azbestu a eternitu bez starostí | ASTANA',
  description:
    'ASTANA, s.r.o. zabezpečuje likvidáciu azbestu a eternitu po celom Slovensku. Cenová ponuka do 24 hodín, dokumentácia, demontáž, balenie, odvoz a potvrdenie o legálnej likvidácii.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'sk_SK',
    url: '/',
    siteName: 'Likvidácia azbestu a eternitu ASTANA',
    title: 'Likvidácia azbestu a eternitu bez starostí | ASTANA',
    description:
      'Pošlite fotky. Pripravíme cenovú ponuku, dokumentáciu, odbornú demontáž, balenie, odvoz a potvrdenie o likvidácii azbestu.',
    images: ['/assets/hero-workers.webp'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Likvidácia azbestu a eternitu bez starostí | ASTANA',
    description: 'Cenová ponuka do 24 hodín, dokumentácia, demontáž, balenie, odvoz a potvrdenie o legálnej likvidácii.',
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
