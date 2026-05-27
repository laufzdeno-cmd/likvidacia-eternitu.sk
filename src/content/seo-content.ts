import { site } from './site';

export type FaqItem = {
  question: string;
  answer: string;
};

export type ServicePageContent = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  quickAnswer: string;
  lead: string;
  sections: Array<{
    title: string;
    text: string;
    items?: string[];
  }>;
  summary: Array<[string, string]>;
  faqs: FaqItem[];
};

export const commonProcessSteps = [
  ['Pošlete výmeru, lokalitu a fotky.', 'Stačí približná výmera v m2, obec alebo okres a fotky strechy či materiálu, ak ich máte.'],
  ['Pripravíme cenovú ponuku.', 'Ponuku nastavíme podľa rozsahu, prístupu, typu materiálu, lokality a potrebnej dokumentácie.'],
  ['Pripravíme potrebné podklady.', 'Po potvrdení zákazky riešime ďalší postup a dokumentáciu podľa konkrétneho prípadu.'],
  ['Bezpečne zdemontujeme a zabalíme materiál.', 'Materiál stabilizujeme, demontujeme kontrolovane a balíme ako nebezpečný odpad.'],
  ['Odvezieme odpad a odovzdáme potvrdenie.', 'Odpad po zabalení odvážame na určené miesto a zákazník dostane súvisiaci doklad.'],
] as const;

export const coreFaqs: FaqItem[] = [
  {
    question: 'Je eternit nebezpečný?',
    answer:
      'Eternit môže byť problém najmä vtedy, keď obsahuje azbest a materiál sa láme, reže alebo inak poškodzuje. Pri manipulácii je preto dôležitý odborný postup, stabilizácia, balenie a legálne odovzdanie odpadu.',
  },
  {
    question: 'Obsahuje každý eternit azbest?',
    answer:
      'Nie každý výrobok označovaný ako eternit musí obsahovať azbest. Pri starších strešných a obkladových materiáloch je však potrebné počítať s možnosťou jeho výskytu a postupovať opatrne.',
  },
  {
    question: 'Môžem eternit odstrániť svojpomocne?',
    answer:
      'Pri materiáloch s možným obsahom azbestu nejde iba o zloženie krytiny. Treba riešiť bezpečnú manipuláciu, balenie, odvoz ako nebezpečný odpad a doklady o likvidácii.',
  },
  {
    question: 'Čo potrebujem pre cenovú ponuku?',
    answer:
      'Najviac pomôže lokalita, približná výmera v m2, typ objektu a fotky materiálu alebo strechy. Ak neviete presnú výmeru, stačí rozumný odhad.',
  },
  {
    question: 'Koľko trvá likvidácia?',
    answer:
      'Čas závisí od rozsahu, prístupu, počasia, lokality a potrebného postupu. Pri menších strechách môže byť samotná práca krátka, príprava a dokumentácia však závisia od konkrétnej zákazky.',
  },
  {
    question: 'Od čoho závisí cena?',
    answer:
      'Cenu ovplyvňuje najmä výmera, typ materiálu, výška objektu, prístup, lokalita, rozsah dokumentácie a objem odpadu. Preto pripravujeme individuálnu cenovú ponuku.',
  },
  {
    question: 'Aké doklady dostanem?',
    answer:
      'Po ukončení zákazky dostanete potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu a typu práce. Cieľom je, aby ste mali preukázateľný doklad o legálnej likvidácii.',
  },
  {
    question: 'Pôsobíte po celom Slovensku?',
    answer: `${site.legalName} zabezpečuje likvidáciu azbestu a eternitu po celom Slovensku podľa rozsahu zákazky a dostupných termínov.`,
  },
];

export const faqPageItems: FaqItem[] = [
  ...coreFaqs,
  {
    question: 'Riešite aj malé strechy?',
    answer:
      'Áno, naceniť vieme aj menšie strechy, garáže alebo hospodárske objekty. Pri menšom rozsahu je dôležité uviesť lokalitu a prístup, aby bola ponuka realistická.',
  },
  {
    question: 'Riešite aj firmy a priemyselné objekty?',
    answer:
      'Áno, riešime aj firmy, správcov objektov, hospodárske budovy a priemyselné priestory. Pri väčších objektoch je dôležitá príprava, logistika a koordinácia.',
  },
  {
    question: 'Čo znamená bezpečné balenie azbestu?',
    answer:
      'Bezpečné balenie znamená, že materiál sa po demontáži pripraví do určených obalov alebo spôsobom vhodným pre ďalšiu manipuláciu a odvoz ako nebezpečný odpad.',
  },
  {
    question: 'Odvážate aj už zložený eternit?',
    answer:
      'Áno, vieme posúdiť aj už zložený materiál. Potrebujeme vedieť, kde sa nachádza, v akom je stave, aký je približný objem a či je prístupný na naloženie.',
  },
  {
    question: 'Treba obhliadka?',
    answer:
      'Nie vždy. Pri mnohých dopytoch stačia fotky, výmera a lokalita. Obhliadka môže byť potrebná pri zložitejšom prístupe, väčšom rozsahu alebo nejasnom type materiálu.',
  },
  {
    question: 'Čo ak neviem presnú výmeru?',
    answer:
      'Uveďte odhad. Presné m2 sa dajú overiť podľa skutočnosti, fotiek alebo následného zamerania. Pre prvú ponuku je dôležité začať približným rozsahom.',
  },
  {
    question: 'Ako poslať fotky?',
    answer:
      'Fotky môžete priložiť priamo do formulára alebo poslať emailom. Ideálne sú zábery celej strechy, detail materiálu, prístup k objektu a miesto, kde by sa odpad nakladal.',
  },
  {
    question: 'Čo je nebezpečný odpad?',
    answer:
      'Nebezpečný odpad je odpad, s ktorým sa musí nakladať špeciálnym spôsobom. Pri azbeste je dôležité balenie, evidencia, odvoz na určené miesto a doklad o likvidácii.',
  },
];

export const servicePages: Record<string, ServicePageContent> = {
  asbestos: {
    slug: '/likvidacia-azbestu/',
    title: 'Likvidácia azbestu po celom Slovensku | ASTANA',
    description:
      'Odborná likvidácia azbestu vrátane dokumentácie, bezpečnej demontáže, balenia, odvozu a potvrdenia. ASTANA, s.r.o. - cenová ponuka do 24 hodín.',
    h1: 'Likvidácia azbestu po celom Slovensku',
    eyebrow: 'Služba',
    quickAnswer:
      'Likvidácia azbestu je odborný postup, pri ktorom sa azbestový materiál bezpečne stabilizuje, demontuje, zabalí, odvezie ako nebezpečný odpad a následne sa zákazníkovi odovzdá potvrdenie o legálnej likvidácii.',
    lead:
      'ASTANA zabezpečuje odbornú likvidáciu azbestu vrátane cenovej ponuky, potrebnej dokumentácie, demontáže, balenia, odvozu a dokladov podľa konkrétnej zákazky.',
    sections: [
      {
        title: 'Kto službu potrebuje',
        text: 'Služba je určená pre majiteľov domov, firmy, správcov objektov, strechárov a vlastníkov materiálu, pri ktorom je podozrenie na obsah azbestu.',
        items: ['rodinné domy', 'garáže a hospodárske budovy', 'haly a technické objekty', 'už zložený materiál pripravený na odvoz'],
      },
      {
        title: 'Aké materiály riešime',
        text: 'Najčastejšie ide o azbestocementové strešné krytiny, šablóny, dosky, obklady a ďalšie materiály posudzované podľa stavu a konkrétnej zákazky.',
      },
      {
        title: 'Dokumentácia a potvrdenie',
        text: 'Pri azbeste je dôležité, aby bol postup preukázateľný. Po ukončení zákazky odovzdávame potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu prác.',
      },
      {
        title: 'Čo si pripraviť',
        text: 'Pre rýchle nacenenie pošlite približnú výmeru v m2, lokalitu, typ objektu, fotky materiálu a kontakt, na ktorom vás vieme zastihnúť.',
      },
    ],
    summary: [
      ['Čo riešime', 'materiály s možným obsahom azbestu, strechy, dosky, obklady a pripravený odpad'],
      ['Kde pôsobíme', 'celé Slovensko'],
      ['Čo potrebujeme od vás', 'm2, lokalitu, fotky a typ objektu'],
      ['Čo zabezpečíme my', 'postup, demontáž, balenie, odvoz a doklady'],
      ['Aký doklad dostanete', 'potvrdenie alebo dokumentáciu podľa rozsahu zákazky'],
      ['Ako rýchlo pripraviť ponuku', 'najlepšie po odoslaní výmery a fotiek'],
    ],
    faqs: coreFaqs.slice(0, 6),
  },
  eternit: {
    slug: '/likvidacia-eternitu/',
    title: 'Likvidácia eternitu zo striech | Bezpečne a legálne | ASTANA',
    description:
      'Likvidácia eternitu zo striech rodinných domov, garáží, hál a hospodárskych budov. Demontáž, balenie, odvoz a potvrdenie o likvidácii.',
    h1: 'Likvidácia eternitu zo striech',
    eyebrow: 'Služba',
    quickAnswer:
      'Likvidácia eternitu je odborné odstránenie strešných alebo obkladových dosiek, ktoré môžu obsahovať azbest. Bezpečný postup zahŕňa stabilizáciu materiálu, opatrnú demontáž bez zbytočného lámania, balenie ako nebezpečný odpad, odvoz na určené miesto a potvrdenie o legálnej likvidácii.',
    lead:
      'Eternit sa nemá zbytočne lámať, rezať ani zhadzovať. ASTANA rieši kontrolovanú demontáž, balenie, odvoz a dokumentáciu podľa konkrétnej strechy alebo objektu.',
    sections: [
      {
        title: 'Prečo postupovať opatrne',
        text: 'Starší eternit môže obsahovať azbest. Riziko vzniká najmä pri poškodení materiálu, preto sa má manipulácia robiť kontrolovane a bez zbytočného prachu.',
      },
      {
        title: 'Čo ASTANA zabezpečí',
        text: 'Zabezpečíme nacenenie, potrebné podklady, stabilizáciu materiálu, demontáž, balenie, odvoz a potvrdenie alebo súvisiacu dokumentáciu.',
      },
      {
        title: 'Ako poslať výmeru a fotky',
        text: 'Do formulára uveďte približnú výmeru strechy v m2, obec alebo okres, typ objektu a priložte fotky celej strechy, detail materiálu a prístup k objektu.',
      },
    ],
    summary: [
      ['Čo riešime', 'eternitové strechy, šablóny a azbestocementové dosky'],
      ['Kde pôsobíme', 'celé Slovensko'],
      ['Čo potrebujeme od vás', 'výmeru, lokalitu, fotky a informáciu, či máte strechára'],
      ['Čo zabezpečíme my', 'bezpečný postup, demontáž, balenie, odvoz a doklady'],
      ['Aký doklad dostanete', 'potvrdenie alebo dokumentáciu po legálnej likvidácii'],
      ['Ako rýchlo pripraviť ponuku', 'odošlite m2 a fotky cez formulár'],
    ],
    faqs: [coreFaqs[0], coreFaqs[1], coreFaqs[2], coreFaqs[3], coreFaqs[5], coreFaqs[6]],
  },
};

export const locationPages = [
  {
    slug: 'poprad',
    name: 'Poprad',
    area: 'Poprade a okolí',
    title: 'Likvidácia azbestu a eternitu Poprad | ASTANA',
    description: 'Odborná likvidácia azbestu a eternitu v Poprade a okolí. Cenová ponuka, dokumentácia, demontáž, balenie, odvoz a potvrdenie.',
    localNote: 'Poprad je sídlo firmy ASTANA, preto je pri dopytoch z regiónu dôležité najmä rýchlo poslať výmeru, fotky a prístup k objektu.',
  },
  {
    slug: 'kosice',
    name: 'Košice',
    area: 'Košiciach a Košickom kraji',
    title: 'Likvidácia azbestu a eternitu Košice | ASTANA',
    description: 'Likvidácia azbestu a eternitu v Košiciach a Košickom kraji vrátane dokumentácie, demontáže, balenia, odvozu a dokladov.',
    localNote: 'Pri väčších mestských objektoch v Košiciach pomôže dopredu popísať prístup, možnosť pristavenia auta a časové obmedzenia na pozemku.',
  },
  {
    slug: 'presov',
    name: 'Prešov',
    area: 'Prešove a Prešovskom kraji',
    title: 'Likvidácia azbestu a eternitu Prešov | ASTANA',
    description: 'Odborná likvidácia azbestu a eternitu v Prešove a Prešovskom kraji. Pošlite m2, lokalitu a fotky pre cenovú ponuku.',
    localNote: 'V Prešovskom kraji často rozhoduje rozsah strechy, dostupnosť objektu a nadväznosť na strechárske práce.',
  },
  {
    slug: 'zilina',
    name: 'Žilina',
    area: 'Žiline a Žilinskom kraji',
    title: 'Likvidácia azbestu a eternitu Žilina | ASTANA',
    description: 'Likvidácia azbestu a eternitu v Žiline a Žilinskom kraji. Demontáž, balenie, odvoz a potvrdenie o likvidácii.',
    localNote: 'Pri zákazkách v Žilinskom kraji je dobré uviesť aj sklon strechy, prístup na pozemok a informáciu, či má nadväzovať nová krytina.',
  },
  {
    slug: 'banska-bystrica',
    name: 'Banská Bystrica',
    area: 'Banskej Bystrici a Banskobystrickom kraji',
    title: 'Likvidácia azbestu a eternitu Banská Bystrica | ASTANA',
    description: 'Likvidácia azbestu a eternitu v Banskej Bystrici a okolí. Cenová ponuka podľa výmery, prístupu, lokality a typu materiálu.',
    localNote: 'Pri rozptýlených obciach v Banskobystrickom kraji cenu ovplyvní aj logistika, prístup k objektu a objem odpadu.',
  },
  {
    slug: 'bratislava',
    name: 'Bratislava',
    area: 'Bratislave a Bratislavskom kraji',
    title: 'Likvidácia azbestu a eternitu Bratislava | ASTANA',
    description: 'Odborná likvidácia azbestu a eternitu v Bratislave a Bratislavskom kraji vrátane podkladov, odvozu a potvrdenia.',
    localNote: 'V Bratislave býva dôležité popísať prístup, parkovanie, časové obmedzenia a to, či ide o rodinný dom, garáž alebo firemný objekt.',
  },
  {
    slug: 'nitra',
    name: 'Nitra',
    area: 'Nitre a Nitrianskom kraji',
    title: 'Likvidácia azbestu a eternitu Nitra | ASTANA',
    description: 'Likvidácia azbestu a eternitu v Nitre a Nitrianskom kraji. Bezpečná demontáž, balenie, odvoz a doklady.',
    localNote: 'Pri dopytoch z Nitrianskeho kraja pomôžu fotky strechy z viacerých strán a informácia, či je materiál ešte na streche alebo už zložený.',
  },
  {
    slug: 'trnava',
    name: 'Trnava',
    area: 'Trnave a Trnavskom kraji',
    title: 'Likvidácia azbestu a eternitu Trnava | ASTANA',
    description: 'Odborná likvidácia azbestu a eternitu v Trnave a Trnavskom kraji. Cenová ponuka podľa m2, fotiek, lokality a prístupu.',
    localNote: 'Pri Trnave a okolí je užitočné uviesť, či sa dá k objektu prísť technikou a či je potrebné práce zladiť so strechárom.',
  },
] as const;

export const articles = [
  {
    slug: 'co-je-eternit-a-kedy-obsahuje-azbest',
    title: 'Čo je eternit a kedy môže obsahovať azbest',
    description: 'Praktické vysvetlenie, čo je eternit, prečo sa pri starších materiáloch rieši azbest a ako postupovať pri podozrení.',
    quickAnswer:
      'Eternit je bežné označenie pre azbestocementové alebo vláknocementové dosky a krytiny. Staršie materiály môžu obsahovať azbest, preto sa pri poškodení, demontáži alebo odvoze odporúča odborné posúdenie a bezpečný postup.',
    body: [
      ['Prečo na veku záleží', 'Pri starších strechách a obkladoch je bezpečnejšie počítať s možnosťou obsahu azbestu, kým sa materiál neposúdi.'],
      ['Čo si všimnúť', 'Dôležitý je typ dosiek, stav materiálu, rozsah poškodenia, prístup k streche a to, či sa s materiálom už manipulovalo.'],
      ['Ako postupovať', 'Materiál zbytočne nelámte ani nerežte. Pošlite fotky, výmeru a lokalitu, aby sa dal navrhnúť ďalší postup.'],
    ],
  },
  {
    slug: 'preco-neodstranovat-eternit-svojpomocne',
    title: 'Prečo neodstraňovať eternit svojpomocne',
    description: 'Prehľad rizík pri svojpomocnom odstraňovaní eternitu a dôvody, prečo je dôležitý odborný postup.',
    quickAnswer:
      'Svojpomocné odstraňovanie eternitu je rizikové najmä pri lámaní, rezaní, zhadzovaní a nesprávnom odpade. Bezpečný postup rieši stabilizáciu, kontrolovanú demontáž, balenie, odvoz ako nebezpečný odpad a doklad o likvidácii.',
    body: [
      ['Riziko prachu', 'Pri poškodení materiálu sa môže zvyšovať riziko uvoľňovania vlákien a prachu.'],
      ['Riziko odpadu', 'Azbestový odpad nepatrí do bežného odpadu a má sa riešiť preukázateľne.'],
      ['Riziko chaosu na stavbe', 'Zhadzovanie krytiny komplikuje balenie, upratovanie aj nadväznosť ďalších prác.'],
    ],
  },
  {
    slug: 'kolko-stoji-likvidacia-azbestu',
    title: 'Koľko stojí likvidácia azbestu',
    description: 'Cena likvidácie azbestu závisí od výmery, prístupu, typu materiálu, lokality a dokumentácie.',
    quickAnswer:
      'Cena likvidácie azbestu je individuálna. Najviac ju ovplyvňuje výmera, typ a stav materiálu, výška objektu, prístup, lokalita, rozsah dokumentácie a objem odpadu. Presnú ponuku je vhodné pripraviť podľa m2 a fotiek.',
    body: [
      ['Prečo nie je univerzálny cenník', 'Rovnaká výmera môže mať rozdielnu náročnosť podľa prístupu, výšky a stavu krytiny.'],
      ['Čo poslať', 'Uveďte m2, obec, typ objektu, fotky strechy a informáciu, či je materiál ešte na streche.'],
      ['Čo má ponuka obsahovať', 'Ponuka má jasne pomenovať demontáž, balenie, odvoz, dokumentáciu a doklad po likvidácii.'],
    ],
  },
  {
    slug: 'ake-doklady-dostanete-po-likvidacii-azbestu',
    title: 'Aké doklady dostanete po likvidácii azbestu',
    description: 'Vysvetlenie, prečo je po likvidácii azbestu dôležité potvrdenie alebo súvisiaca dokumentácia.',
    quickAnswer:
      'Po legálnej likvidácii azbestu má zákazník dostať potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu zákazky. Doklad pomáha preukázať, že s odpadom sa nakladalo určeným spôsobom a materiál neskončil mimo legálneho procesu.',
    body: [
      ['Prečo doklady chrániť', 'Pri budúcom predaji, kontrole alebo správe objektu je dobré mať preukázateľný záznam o likvidácii.'],
      ['Čo sa líši podľa zákazky', 'Rozsah dokumentácie sa môže líšiť podľa objektu, materiálu, objemu a postupu.'],
      ['Kedy sa doklady odovzdajú', 'Doklady sa odovzdávajú po ukončení prác a podľa dohodnutého rozsahu zákazky.'],
    ],
  },
  {
    slug: 'ako-zmerat-strechu-pre-cenovu-ponuku',
    title: 'Ako zmerať strechu pre cenovú ponuku',
    description: 'Jednoduchý postup, ako pripraviť približnú výmeru strechy v m2 pre nacenenie likvidácie eternitu.',
    quickAnswer:
      'Pre prvú cenovú ponuku stačí približná výmera strechy v m2. Ak presné rozmery nepoznáte, pošlite odhad, rozmery pôdorysu, počet strán strechy a fotky. Presnejší rozsah sa dá overiť podľa skutočnosti.',
    body: [
      ['Začnite odhadom', 'Pri sedlovej streche pomôže dĺžka a šírka jednej strany, prípadne rozmery domu a sklon.'],
      ['Priložte fotky', 'Fotky celej strechy a detail materiálu často povedia viac ako nepresný výpočet.'],
      ['Uveďte nejasnosti', 'Ak si nie ste istí, napíšte, že ide o odhad. Ponuka sa dá spresniť po kontrole údajov.'],
    ],
  },
  {
    slug: 'co-poslat-pre-nacenenie-likvidacie-eternitu',
    title: 'Čo poslať pre nacenenie likvidácie eternitu',
    description: 'Prehľad údajov, ktoré urýchlia cenovú ponuku na likvidáciu eternitu.',
    quickAnswer:
      'Pre rýchle nacenenie likvidácie eternitu pošlite lokalitu, približnú výmeru v m2, fotky strechy alebo materiálu, typ objektu, informáciu o prístupe a kontakt. Ak niečo neviete, uveďte odhad.',
    body: [
      ['Základné údaje', 'Obec alebo okres, výmera, typ objektu a kontakt sú základ pre prvé posúdenie.'],
      ['Fotky', 'Pošlite celkový záber strechy, detail krytiny, okolie objektu a prípadné miesto nakládky.'],
      ['Dôležité okolnosti', 'Napíšte, či je materiál na streche alebo už zložený a či treba práce zladiť so strechárom.'],
    ],
  },
  {
    slug: 'azbest-v-interieri-vs-exterieri',
    title: 'Azbest v interiéri a exteriéri: v čom je rozdiel',
    description: 'Vecné porovnanie prístupu k materiálom s možným obsahom azbestu v interiéri a exteriéri.',
    quickAnswer:
      'Azbest v interiéri a exteriéri sa posudzuje podľa typu materiálu, stavu, prístupu a rizika poškodenia. V oboch prípadoch je dôležitý kontrolovaný postup, obmedzenie prachu, bezpečné balenie odpadu a preukázateľná likvidácia.',
    body: [
      ['Exteriér', 'Pri strechách je častou témou výška, sklon, počasie, prístup a nadväznosť strechárskych prác.'],
      ['Interiér', 'V interiéri je dôležité riešiť kontrolu priestoru, prístup a ochranu okolia.'],
      ['Spoločné pravidlo', 'Materiál zbytočne nepoškodzujte a nechajte si navrhnúť bezpečný postup.'],
    ],
  },
  {
    slug: 'odvoz-a-balenie-azbestoveho-odpadu',
    title: 'Odvoz a balenie azbestového odpadu',
    description: 'Ako premýšľať o balení a odvoze azbestového odpadu, aby bol postup bezpečný a preukázateľný.',
    quickAnswer:
      'Azbestový odpad má byť po demontáži bezpečne zabalený, označený alebo pripravený spôsobom vhodným pre odvoz na určené miesto. Dôležité je, aby materiál nezostal voľne uložený a zákazník mal doklad o legálnej likvidácii.',
    body: [
      ['Balenie nie je detail', 'Správne balenie znižuje riziko zbytočnej manipulácie a uľahčuje odvoz.'],
      ['Prístup k odpadu', 'Pri už zloženom materiáli je dôležité vedieť, kde leží a či sa k nemu dá dostať technikou.'],
      ['Doklad po ukončení', 'Po odvoze má zákazník dostať potvrdenie alebo dokumentáciu podľa rozsahu zákazky.'],
    ],
  },
] as const;
