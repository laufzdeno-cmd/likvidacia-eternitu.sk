import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Poradňa | ASTANA', description: 'Základné informácie k likvidácii azbestu a eternitu.' };

export default function AdvicePage() {
  return (
    <SimplePublicPage
      eyebrow="Poradňa"
      title="Poradňa k azbestu a eternitu"
      lead="Pripravujeme odborné články. Zatiaľ nájdete najdôležitejšie odpovede vo FAQ na úvodnej stránke."
      sections={[
        { title: 'Ako zistiť eternit', text: 'Ak si nie ste istí, pošlite fotky strechy alebo materiálu. Ozveme sa s ďalším postupom.' },
        { title: 'Prečo nezhadzovať zo strechy', text: 'Pri manipulácii je dôležitý odborný postup, stabilizácia materiálu a balenie do určených obalov.' },
        { title: 'Čo pripraviť', text: 'Kontakt, lokalitu, približnú výmeru, typ objektu a fotky.' },
      ]}
    />
  );
}
