import type { Metadata } from 'next';
import SimplePublicPage from '../simple-public-page';
import { buildPageMetadata } from '../seo-components';

const path = '/prepojenie-gmailu/';

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: 'ASTANA – cenové ponuky a Gmail',
    description: 'Ako interný admin ASTANA označuje už odoslané cenové ponuky v pripojenom firemnom Gmail účte.',
    path,
  }),
  robots: { index: false, follow: true },
};

export default function GmailConnectionInformationPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Prepojenie Gmailu', path }}
      eyebrow="Interná aplikácia ASTANA"
      title="ASTANA – cenové ponuky a Gmail"
      lead="Interný admin ASTANA pomáha tímu sledovať odoslané cenové ponuky. Po výslovnom pripojení firemného Gmail účtu označí presnú kópiu už odoslanej ponuky zeleným štítkom a hviezdičkou."
      sections={[
        {
          title: 'Na čo prepojenie slúži',
          text: 'Ponuku najprv skontroluje a schváli pracovník v admine. Po úspešnom odoslaní cez firemnú emailovú službu aplikácia vyhľadá jej kópiu v priečinku Odoslané podľa technického Message-ID. Ak nájde práve jednu zhodu, pridá štítok „✓ CP odoslaná“ a hviezdičku. Pri nejednoznačnej zhode správu nemení.',
        },
        {
          title: 'Aký prístup žiadame',
          text: 'Google vyžaduje oprávnenie Gmail modify na vyhľadanie a označenie konkrétnej správy. Jeho systémový opis zahŕňa aj širšie možnosti práce s poštou. Naša aplikácia ho používa iba na kontrolu odoslanej kópie a zmenu jej označenia. Cez Gmail API neposiela cenové ponuky ani iné správy.',
        },
        {
          title: 'Kto môže účet pripojiť',
          text: 'Pripojenie cez zabezpečený súhlas Google spúšťa iba superadmin. Aplikácia prijme iba určený firemný účet. Heslo Gmailu sa do nášho adminu nezadáva. Superadmin môže prístup v nastaveniach kedykoľvek odpojiť.',
        },
        {
          title: 'Ako chránime údaje',
          text: 'Aplikácia neukladá telo Gmail správ. Ukladá zašifrovaný obnovovací token, adresu pripojeného účtu, technické identifikátory označenej správy a stav spracovania. Údaje z Gmail API nepoužíva na reklamu, profilovanie ani trénovanie modelov a neposkytuje ich tretím stranám.',
        },
      ]}
    >
      <p>
        Podrobnosti o spracovaní údajov sú v <a href="/ochrana-osobnych-udajov/">zásadách ochrany osobných údajov</a>.
        Pozrite si aj <a href="/podmienky-pouzivania/">podmienky používania</a> a <a href="/kontakt/">kontakt na ASTANA</a>.
      </p>
    </SimplePublicPage>
  );
}
