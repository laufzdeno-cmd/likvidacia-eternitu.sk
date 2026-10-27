import SimplePublicPage from '../simple-public-page';
import { buildPageMetadata } from '../seo-components';

export const metadata = buildPageMetadata({
  title: 'Ochrana osobných údajov | ASTANA',
  description: 'Informácie o spracovaní osobných údajov pri dopyte na likvidáciu azbestu a eternitu.',
  path: '/ochrana-osobnych-udajov/',
});

export default function PrivacyPage() {
  return (
    <SimplePublicPage
      breadcrumb={{ name: 'Ochrana osobných údajov', path: '/ochrana-osobnych-udajov/' }}
      eyebrow="GDPR"
      title="Ochrana osobných údajov"
      lead="Osobné údaje spracúvame bezpečne, primerane a iba na účely súvisiace s dopytom, cenovou ponukou, realizáciou zákazky a zlepšovaním služieb."
      sections={[
        {
          title: 'Prevádzkovateľ',
          text: 'ASTANA, s.r.o., Scherffelova 1364/28, Poprad 058 01, IČO: 46 157 701, DIČ: 2023253771, IČ DPH: SK2023253771, email: astana@astana.sk.',
        },
        {
          title: 'Aké údaje zbierame',
          text: 'Meno, telefón a email z formulára dopytu alebo žiadosti o spoluprácu. Pri cenovom dopyte aj výmeru, lokalitu, typ materiálu, typ objektu a termín.\n\nAk nám napíšete cez firemnú Facebook stránku, spracujeme meno z Facebook profilu, obsah konverzácie, čas správ a typ prípadnej prílohy, aby sme vedeli odpovedať a vybaviť dopyt. Prílohy z Facebooku sa automaticky nezverejňujú na webe.\n\nPri žiadosti o spoluprácu spracúvame údaje o skúsenostiach a dobrovoľne priložený životopis. Fotky strechy a životopis sú súkromné a nie sú verejne prístupné.\n\nPri ochrane nahrávania fotografií spracúva aplikácia HMAC odtlačok IP adresy; v čítači limitu neukladá surovú IP adresu.\n\nAk udelíte súhlas s analytikou, spracúvame pseudonymné ID relácie, navštívenú cestu, typ zariadenia, doménu odkazujúcej stránky a prípadné UTM označenia kampane. Pri dopyte odoslanom počas platného súhlasu sa povolené UTM údaje a prvá stránka zaznamenaná v analytickej relácii priradia k záznamu dopytu. Identifikátory kliknutia OpenAI, Google alebo Meta sa k dopytu priradia iba pri súhlase s analytikou aj marketingovým meraním; v administrácii sa zobrazí len platforma, nie samotný identifikátor. Tieto údaje nie sú anonymné len preto, že neobsahujú meno ani email.',
        },
        {
          title: 'Prečo ich zbierame',
          text: 'Údaje používame na spracovanie cenovej ponuky, komunikáciu so zákazníkom vrátane odpovedí cez firemnú Facebook stránku, plánovanie realizácie a posúdenie možnej spolupráce so živnostníkom alebo partiou. Analytické údaje a priradenie povoleného zdroja ku konkrétnemu dopytu používame iba po udelení analytického súhlasu; identifikátory reklamných kliknutí vyžadujú aj súhlas s marketingovým meraním.',
        },
        {
          title: 'Ako dlho ich uchovávame',
          text: 'Dopyt bez zákazky uchovávame 6 mesiacov; prípadné údaje o zdroji, ktoré boli k nemu priradené na základe súhlasu, sa uchovávajú spolu s dopytom. Zákazku uchovávame 5 rokov z dôvodu daňových a účtovných povinností.\n\nHMAC odtlačok IP slúži na limitovanie v 10-minútovom okne. Po jeho skončení sa odstráni pri ďalšej požiadavke alebo plánovanej dennej údržbe; v bežnej prevádzke sa tak stane najneskôr približne do 24 hodín. Pri výpadku údržby sa môže odstránenie oneskoriť do jej obnovenia.\n\nVoľba cookies sa uchováva v prehliadači najviac 12 mesiacov.\n\nSamostatné údaje o návštevnosti uchovávame v aktívnom systéme 12 mesiacov. Po uplynutí lehoty ich vyradíme zo štatistík a odstránime pri dennej údržbe. Pri výpadku sa môže odstránenie oneskoriť do jej obnovenia.\n\nNové prevádzkové zálohy tieto analytické udalosti neobsahujú. Staršie zálohy môžu obsahovať historické údaje a slúžia iba na obnovu systému. Pri prípadnej obnove treba starú analytiku vynechať alebo odstrániť pred opätovným sprístupnením systému.',
        },
        {
          title: 'Vaše práva',
          text: 'Máte právo na prístup, opravu, vymazanie, prenosnosť údajov a právo namietať spracovanie. O vymazanie údajov môžete požiadať emailom na astana@astana.sk.',
        },
        {
          title: 'Poskytovanie údajov',
          text: 'Dáta neposkytujeme tretím stranám okrem prepravcov, skládok, účtovníctva a technických dodávateľov v nevyhnutnom rozsahu pre plnenie zmluvy, zákonných povinností a bezpečnú prevádzku služby.\n\nPri komunikácii cez Facebook spracúva správy aj spoločnosť Meta podľa pravidiel svojej platformy; naša interná administrácia ich používa iba na vybavenie komunikácie a dopytu.\n\nAk udelíte samostatný súhlas s marketingovým meraním, po potvrdenom dopyte môžeme platforme OpenAI Ads, Google Ads alebo Meta odoslať konverznú udalosť. OpenAI Ads dostane názov udalosti, stabilné pseudonymné ID udalosti, zdrojovú stránku a reklamný identifikátor z odkazu; neposielame mu meno, telefón, email, poznámku ani nahraté fotografie.\n\nMeta dostane stabilné ID udalosti, všeobecnú kategóriu materiálu, zdrojovú stránku, obmedzený údaj o prehliadači a zahashovaný email a telefón na priradenie konverzie. Hashovanie nie je anonymizácia. Pri načítaní značiek môžu platformy spracovať technické údaje prehliadača a pripojenia. Odvolanie marketingového súhlasu zastaví nové udalosti a zruší ešte neodoslané udalosti priradené k danému prehliadaču.',
        },
        {
          title: 'Interné prepojenie Gmailu',
          text: 'Firemný admin môže byť so súhlasom superadmina prepojený s určeným Gmail účtom cez Google OAuth. Prepojenie slúži iba na nájdenie presnej firemnej kópie už odoslanej cenovej ponuky podľa technického Message-ID a na pridanie zeleného štítka a hviezdičky. Aplikácia neukladá telo Gmail správ. Ukladá zašifrovaný obnovovací token, email pripojeného firemného účtu, technické identifikátory označenej správy a prevádzkový stav. Údaje získané cez Gmail API nepoužívame na reklamu, profilovanie zákazníkov ani trénovanie modelov a neposkytujeme ich tretím stranám. Superadmin môže prepojenie odpojiť; tým sa uložený token odstráni a aplikácia prestane Gmail meniť.',
        },
        {
          title: 'Cookies a analytika',
          text: 'Analytika sa vykonáva iba po vašom analytickom súhlase. Identifikátory kliknutia OpenAI, Google alebo Meta sa spracúvajú len pri súhlase s analytikou aj marketingovým meraním. Konverzná udalosť po potvrdenom dopyte sa odošle iba pri marketingovom súhlase; nie je podmienkou prijatia dopytu. Odmietnutie súhlasu neblokuje formulár. Podrobnosti a zmena voľby sú na stránke Zásady cookies.',
        },
      ]}
    />
  );
}
