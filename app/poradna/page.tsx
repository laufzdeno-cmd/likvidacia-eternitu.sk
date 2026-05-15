import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Poradňa | ASTANA', description: 'Základné informácie k likvidácii azbestu a eternitu.' };

export default function AdvicePage() {
  return (
    <SimplePublicPage
      eyebrow="Poradňa"
      title="Poradňa k azbestu a eternitu"
      lead="Pripravujeme odborné články. Zatiaľ nájdete najdôležitejšie odpovede vo FAQ na úvodnej stránke."
      sections={[
        { title: 'Ako zistiť eternit', text: 'Ak si nie ste istí typom materiálu, priložte fotky strechy alebo materiálu. Na cenovú ponuku je kľúčová aj približná výmera v m².' },
        { title: 'Prečo nezhadzovať zo strechy', text: 'Pri manipulácii je dôležitý odborný postup, stabilizácia materiálu a balenie do určených obalov.' },
        { title: 'Čo pripraviť', text: 'Kontakt, lokalitu, približnú výmeru v m², typ objektu a fotky ako pomocný podklad.' },
      ]}
    />
  );
}
