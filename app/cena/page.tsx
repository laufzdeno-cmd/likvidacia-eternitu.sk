import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Cena likvidácie azbestu a eternitu | ASTANA', description: 'Od čoho závisí cena likvidácie azbestu a eternitu.' };

export default function PricePage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Cena likvidácie azbestu a eternitu', path: '/cena/' }}
      eyebrow="Cena"
      title="Cena likvidácie azbestu a eternitu"
      lead="Cena závisí najmä od približnej výmery v m², typu materiálu, výšky objektu, prístupu, lokality, dokumentácie a dopravy. Fotky sú pomocný podklad na spresnenie prístupu a náročnosti."
      sections={[
        { title: 'Výmera a materiál', text: 'Najväčší vplyv má počet m² a typ azbestového materiálu.' },
        { title: 'Dokumentácia', text: 'Do kalkulácie vstupujú aj potrebné podania, evidencia a doklady podľa rozsahu zákazky.' },
        { title: 'Doprava', text: 'Pri zákazkách nad 100 m² dopravu neúčtujeme.' },
      ]}
    />
  );
}
