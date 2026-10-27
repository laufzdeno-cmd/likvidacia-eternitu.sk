import SimplePublicPage from '../simple-public-page';
import { buildPageMetadata } from '../seo-components';

export const metadata = buildPageMetadata({
  title: 'Podmienky používania | ASTANA',
  description: 'Základné podmienky používania webu likvidacia-eternitu.sk.',
  path: '/podmienky-pouzivania/',
});

export default function TermsPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Podmienky používania', path: '/podmienky-pouzivania/' }}
      eyebrow="Podmienky"
      title="Podmienky používania"
      lead="Informácie na webe slúžia na predstavenie služby a prijatie dopytu. Cenová ponuka je nezáväzná, kým nie je individuálne potvrdená."
      sections={[
        { title: 'Dopyt nie je automatická objednávka', text: 'Formulár slúži na prvé posúdenie a prípravu nezáväznej ponuky. Odoslaním dopytu sa automaticky nepotvrdzuje realizácia, cena ani termín. Rozsah zákazky a podmienky si následne dohodneme individuálne.' },
        { title: 'Cenová ponuka a orientačný výpočet', text: 'Cena sa pripravuje najmä podľa približnej výmery v m², lokality, typu materiálu, prístupu a dohodnutého rozsahu. Kalkulátor zobrazuje iba orientačný rozsah; konkrétne položky a DPH určuje ponuka. Ak sa zmenia podklady alebo požadované práce, treba si potvrdiť aj zodpovedajúci rozsah ponuky.' },
        { title: 'Podklady a fotografie', text: 'Fotografie sú voliteľný pomocný podklad. Približný alebo neznámy údaj označte, aby sa nepovažoval za overené zameranie. Kvôli dopytu nevstupujte na starú krytinu a s materiálom zbytočne nemanipulujte. Z fotografie sa nedá spoľahlivo potvrdiť obsah azbestu.' },
        { title: 'Nadväzujúca nová strecha', text: 'Rozsah služieb ASTANY určuje konkrétna cenová ponuka. Pri samostatne odporučenom strechárovi sa ponuka, dohoda a zodpovednosť za jeho strechársku prácu riešia priamo s ním. Termíny a prevzatie pracoviska si treba zosúladiť pred realizáciou.' },
        { title: 'Informačný obsah webu', text: 'Články a všeobecné odpovede vysvetľujú službu a pomáhajú pri príprave dopytu. Nenahrádzajú individuálne posúdenie stavby, určenie zloženia materiálu ani konkrétny pracovný postup. Ak sa vaša situácia od opisu líši, uveďte ju pri kontakte.' },
        { title: 'Kontakt', text: 'ASTANA, s.r.o., 0905 217 946, astana@astana.sk.' },
      ]}
    />
  );
}
