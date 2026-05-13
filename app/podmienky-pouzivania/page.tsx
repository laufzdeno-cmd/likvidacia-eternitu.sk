import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Podmienky používania | ASTANA', description: 'Základné podmienky používania webu likvidacia-eternitu.sk.' };

export default function TermsPage() {
  return (
    <SimplePublicPage
      eyebrow="Podmienky"
      title="Podmienky používania"
      lead="Informácie na webe slúžia na predstavenie služby a prijatie dopytu. Cenová ponuka je nezáväzná, kým nie je individuálne potvrdená."
      sections={[
        { title: 'Cenová ponuka', text: 'Cena sa pripravuje podľa zaslaných údajov, fotiek, rozsahu a doplnených informácií.' },
        { title: 'Obsah webu', text: 'Texty na webe sú informačné a nenahrádzajú individuálne posúdenie konkrétnej zákazky.' },
        { title: 'Kontakt', text: 'ASTANA, s.r.o., 0905 217 946, astana@astana.sk.' },
      ]}
    />
  );
}
