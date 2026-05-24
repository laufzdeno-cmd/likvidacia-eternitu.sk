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
      lead="Osobné údaje spracúvame bezpečne, primerane a iba na účely súvisiace s dopytom, cenovou ponukou, realizáciou zákazky a zlepšovaním služieb."
      sections={[
        { title: 'Prevádzkovateľ', text: 'ASTANA, s.r.o., Scherffelova 1364/28, 058 01 Poprad, IČO: 46 157 701, email: astana@astana.sk.' },
        { title: 'Aké údaje zbierame', text: 'Meno, telefón a email z formulára dopytu. Výmeru, lokalitu a typ materiálu z formulára. Fotky strechy sú voliteľné. Analytické dáta spracúvame anonymne, bez ukladania IP adries.' },
        { title: 'Prečo ich zbierame', text: 'Údaje používame na spracovanie cenovej ponuky, komunikáciu so zákazníkom a zlepšovanie služieb formou anonymnej analytiky.' },
        { title: 'Ako dlho ich uchovávame', text: 'Dopyt bez zákazky uchovávame 6 mesiacov. Zákazku uchovávame 5 rokov z dôvodu daňových a účtovných povinností. Analytické dáta uchovávame najviac 12 mesiacov.' },
        { title: 'Vaše práva', text: 'Máte právo na prístup, opravu, vymazanie, prenosnosť údajov a právo namietať spracovanie. Kontakt: astana@astana.sk.' },
        { title: 'Cookies', text: 'Stránka používa iba funkčné cookies. Nepoužívame reklamné ani sledovacie cookies tretích strán.' },
      ]}
    />
  );
}
