import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Likvidácia azbestu | ASTANA', description: 'Odborná likvidácia azbestu vrátane dokumentácie, demontáže, balenia, odvozu a potvrdenia.' };

export default function AsbestosPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Likvidácia azbestu', path: '/likvidacia-azbestu/' }}
      eyebrow="Služba"
      title="Likvidácia azbestu"
      lead="Zabezpečujeme odborný postup pri materiáloch obsahujúcich azbest: dokumentáciu, stabilizáciu, demontáž, balenie, odvoz a potvrdenie o likvidácii."
      sections={[
        { title: 'Čo riešime', text: 'Azbestové strechy, azbestocementové rúry, obloženia, fasády, Boletické panely a iné materiály podľa rozsahu zákazky.' },
        { title: 'Postup', text: 'Zadajte približnú výmeru v m² a základné údaje. Fotky sú pomocný podklad na posúdenie materiálu, prístupu a náročnosti. Pripravíme cenovú ponuku a po potvrdení riešime potrebné podania a realizáciu.' },
        { title: 'Doklady', text: 'Po ukončení a úhrade zákazky odovzdávame súvisiacu dokumentáciu podľa typu a rozsahu prác.' },
      ]}
    />
  );
}
