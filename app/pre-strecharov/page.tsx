import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Spolupráca pre strechárov | ASTANA', description: 'Zladenie demontáže eternitu so strechármi.' };

export default function RoofersPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Pre strechárov', path: '/pre-strecharov/' }}
      eyebrow="Pre strechárov"
      title="Robíte výmenu eternitovej strechy?"
      lead="Ak zákazník potrebuje legálne odstrániť eternit, pošlite nám základné údaje. Demontáž vieme naplánovať tak, aby ste mohli plynulo pokračovať."
      sections={[
        { title: 'Zladenie termínu', text: 'Demontáž plánujeme tak, aby nadväzovala na fóliu, latovanie alebo ďalšie práce.' },
        { title: 'Jasná komunikácia', text: 'Najdôležitejšia je približná výmera v m², lokalita, typ strechy a termín. Fotky pomôžu spresniť prístup a náročnosť.' },
        { title: 'Dopyt', text: 'Použite formulár na úvodnej stránke a do poznámky uveďte, že ide o strechársku spoluprácu.' },
      ]}
    />
  );
}
