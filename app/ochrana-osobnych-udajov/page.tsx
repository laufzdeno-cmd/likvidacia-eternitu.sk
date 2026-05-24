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
        {
          title: 'Prevádzkovateľ',
          text: 'ASTANA, s.r.o., Scherffelova 1364/28, 058 01 Poprad, IČO: 44 167 701, DIČ: 2022353771, IČ DPH: SK2022353771, email: astana@astana.sk.',
        },
        {
          title: 'Aké údaje zbierame',
          text: 'Meno, telefón a email z formulára dopytu. Výmeru, lokalitu, typ materiálu, typ objektu a termín z formulára. Fotky strechy sú voliteľné. Analytické dáta spracúvame anonymne, bez ukladania IP adries.',
        },
        {
          title: 'Prečo ich zbierame',
          text: 'Údaje používame na spracovanie cenovej ponuky, komunikáciu so zákazníkom, plánovanie realizácie a zlepšovanie služieb formou first-party anonymnej analytiky bez IP adries.',
        },
        {
          title: 'Ako dlho ich uchovávame',
          text: 'Dopyt bez zákazky uchovávame 6 mesiacov. Zákazku uchovávame 5 rokov z dôvodu daňových a účtovných povinností. Analytické dáta uchovávame najviac 12 mesiacov.',
        },
        {
          title: 'Vaše práva',
          text: 'Máte právo na prístup, opravu, vymazanie, prenosnosť údajov a právo namietať spracovanie. O vymazanie údajov môžete požiadať emailom na astana@astana.sk.',
        },
        {
          title: 'Poskytovanie údajov',
          text: 'Dáta neposkytujeme tretím stranám okrem prepravcov, skládok, účtovníctva a technických dodávateľov v nevyhnutnom rozsahu pre plnenie zmluvy, zákonných povinností a bezpečnú prevádzku služby.',
        },
        {
          title: 'Cookies a analytika',
          text: 'Stránka používa iba funkčné cookies a first-party analytiku bez IP adries. Nepoužívame reklamné ani sledovacie cookies tretích strán.',
        },
      ]}
    />
  );
}
