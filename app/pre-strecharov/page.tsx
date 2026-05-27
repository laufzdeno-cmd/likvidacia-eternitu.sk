import SimplePublicPage from '../simple-public-page';
import { buildPageMetadata, TrustComplianceSection } from '../seo-components';

export const metadata = buildPageMetadata({
  title: 'Likvidácia eternitu pre strechárov | ASTANA',
  description: 'Informácie pre strechárov, ktorí potrebujú zladiť bezpečnú demontáž eternitu s výmenou strechy.',
  path: '/pre-strecharov/',
});

export default function RoofersPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Pre strechárov', path: '/pre-strecharov/' }}
      eyebrow="Pre strechárov"
      title="Robíte výmenu eternitovej strechy?"
      lead="Ak zákazník potrebuje legálne odstrániť eternit, pošlite nám základné údaje. Demontáž vieme naplánovať tak, aby ste mohli plynulo pokračovať."
      sections={[
        { title: 'Zladenie termínu', text: 'Demontáž plánujeme tak, aby nadväzovala na fóliu, latovanie alebo ďalšie práce.' },
        { title: 'Jasná komunikácia', text: 'Najdôležitejšia je približná výmera v m2, lokalita, typ strechy a termín. Fotky pomôžu spresniť prístup a náročnosť.' },
        { title: 'Dopyt', text: 'Použite formulár na úvodnej stránke a do poznámky uveďte, že ide o strechársku spoluprácu.' },
      ]}
    >
      <section className="seo-section">
        <h2>Prečo oddeliť strechársku prácu od azbestovej časti</h2>
        <p className="seo-lead">
          Ak strechár zloží eternit bez úradného postupu, problém často zostane zákazníkovi na pozemku. ASTANA rieši azbestovú časť odborne, aby strechár mohol nadviazať novou strechou bez toho, aby sa miešal do likvidácie nebezpečného odpadu.
        </p>
      </section>
      <TrustComplianceSection />
    </SimplePublicPage>
  );
}
