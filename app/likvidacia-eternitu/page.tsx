import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Likvidácia eternitu | ASTANA', description: 'Likvidácia eternitu a azbestocementových šablón po celom Slovensku.' };

export default function EternitPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Likvidácia eternitu', path: '/likvidacia-eternitu/' }}
      eyebrow="Služba"
      title="Likvidácia eternitu"
      lead="Eternit nezhadzujeme zo strechy. Materiál po stabilizácii ukladáme do určených obalov a riešime aj odvoz a doklady."
      sections={[
        { title: 'Bez zhadzovania', text: 'Šablóny a dosky sa po stabilizácii ukladajú priamo do určených obalov, aby sa obmedzil neporiadok a zbytočná manipulácia.' },
        { title: 'Zladenie so strechárom', text: 'Ak máte strechára, termín vieme koordinovať tak, aby práce nadväzovali. Ak ho nemáte, uveďte to v dopyte.' },
        { title: 'Cenová ponuka', text: 'Na nacenenie je najdôležitejšia približná výmera v m², lokalita a typ objektu. Fotky strechy alebo materiálu pomôžu spresniť prístup a náročnosť.' },
      ]}
    />
  );
}
