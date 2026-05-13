import SimplePublicPage from '../simple-public-page';

export const metadata = {
  title: 'Ochrana osobných údajov | ASTANA',
  description: 'Informácie o spracovaní osobných údajov pri dopyte na likvidáciu azbestu a eternitu.',
};

export default function PrivacyPage() {
  return (
    <SimplePublicPage
      eyebrow="GDPR"
      title="Ochrana osobných údajov"
      lead="Osobné údaje spracúvame najmä na vybavenie dopytu, prípravu cenovej ponuky a komunikáciu so zákazníkom."
      sections={[
        { title: 'Prevádzkovateľ', text: 'ASTANA, s.r.o., Scherffelova 1364/28, 058 01 Poprad, IČO: 46 157 701.' },
        { title: 'Účel spracovania', text: 'Údaje z formulára používame na kontaktovanie zákazníka, nacenenie zákazky a súvisiacu obchodnú komunikáciu.' },
        { title: 'Rozsah údajov', text: 'Spracúvame meno, telefón, email, lokalitu, údaje o objekte, poznámku a priložené fotky.' },
        { title: 'Kontakt', text: 'V otázkach ochrany údajov nás kontaktujte na astana@astana.sk.' },
      ]}
    />
  );
}
