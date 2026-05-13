import SimplePublicPage from '../simple-public-page';

export const metadata = { title: 'Cookies | ASTANA', description: 'Informácie o používaní cookies na webe likvidacia-eternitu.sk.' };

export default function CookiesPage() {
  return (
    <SimplePublicPage
      eyebrow="Cookies"
      title="Informácie o cookies"
      lead="Web používa nevyhnutné technické prvky potrebné na fungovanie stránky a spracovanie formulára. Analytické a marketingové nástroje sa majú zapínať až po súhlase používateľa."
      sections={[
        { title: 'Nevyhnutné cookies', text: 'Slúžia na bezpečné fungovanie formulára, adminu a základných nastavení stránky.' },
        { title: 'Analytika', text: 'Ak bude nasadená analytika, musí byť spustená až po udelení súhlasu v cookie lište.' },
        { title: 'Kontakt', text: 'V otázkach ochrany údajov nás kontaktujte na astana@astana.sk.' },
      ]}
    />
  );
}
