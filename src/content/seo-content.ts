import { adviceArticles } from './advice-articles';
import { serviceDocumentationOutcome, site } from './site';

export type FaqItem = {
  question: string;
  answer: string;
  relatedLink?: {
    href: string;
    label: string;
  };
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
  ['Pošlete výmeru a lokalitu.', 'Stačí približná výmera v m2 a obec alebo okres. Fotky strechy či materiálu sú voliteľné.'],
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
      'Odstraňovanie materiálu s obsahom azbestu zo stavieb patrí oprávnenej osobe. Odbornú firmu oslovte pred zásahom do krytiny; treba pripraviť pracovisko, postup, balenie, odvoz aj dokumentáciu.',
    relatedLink: {
      href: '/postup/',
      label: 'Pozrite si odborný postup',
    },
  },
  {
    question: 'Čo potrebujem pre cenovú ponuku?',
    answer:
      'Najviac pomôže lokalita, približná výmera v m2 a typ objektu. Fotky materiálu alebo strechy sú voliteľné. Ak neviete presnú výmeru, stačí rozumný odhad.',
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
    relatedLink: {
      href: '/cena-likvidacie-azbestu/',
      label: 'Ako sa tvorí orientačná cena',
    },
  },
  {
    question: 'Aké doklady dostanem?',
    answer:
      'Po ukončení zákazky dostanete potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu a typu práce. Cieľom je, aby ste mali preukázateľný doklad o legálnej likvidácii.',
    relatedLink: {
      href: '/postup/',
      label: 'Čo sa deje od dopytu po odovzdanie dokladov',
    },
  },
  {
    question: 'Pôsobíte po celom Slovensku?',
    answer: `${site.legalName} zabezpečuje likvidáciu azbestu a eternitu po celom Slovensku podľa rozsahu zákazky a dostupných termínov.`,
    relatedLink: {
      href: '/kde-posobime/',
      label: 'Ako plánujeme práce po celom Slovensku',
    },
  },
];

export const faqPageItems: FaqItem[] = [
  ...coreFaqs,
  {
    question: 'Treba na práce povolenie od RÚVZ?',
    answer:
      'Pri plánovanom odstraňovaní azbestu držiteľ oprávnenia písomne oznamuje práce príslušnému RÚVZ najmenej 30 dní vopred a predkladá požadované podklady. Ide o oznámenie, nie o žiadosť o povolenie. Konkrétny postup pripravíme podľa stavby.',
    relatedLink: {
      href: '/postup/',
      label: 'Pozrite si postup pred začiatkom prác',
    },
  },
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
      'Nie vždy. Pri mnohých dopytoch stačí výmera a lokalita; voliteľné fotky pomôžu ponuku spresniť. Obhliadka môže byť potrebná pri zložitejšom prístupe, väčšom rozsahu alebo nejasnom type materiálu.',
  },
  {
    question: 'Čo ak neviem presnú výmeru?',
    answer:
      'Uveďte odhad. Presné m2 sa dajú overiť podľa skutočnosti, fotiek alebo následného zamerania. Pre prvú ponuku je dôležité začať približným rozsahom.',
  },
  {
    question: 'Ako poslať fotky?',
    answer:
      'Fotky sú voliteľné. Ak ich máte, môžete ich priložiť priamo do formulára alebo poslať emailom. Pomôže záber celej strechy, detail materiálu, prístup k objektu a miesto nakládky.',
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
      `Likvidácia azbestu je odborný postup, pri ktorom sa azbestový materiál bezpečne stabilizuje, demontuje, zabalí a odvezie ako nebezpečný odpad. Zákazníkovi sa následne odovzdá ${serviceDocumentationOutcome}.`,
    lead:
      'ASTANA zabezpečuje odbornú likvidáciu azbestu vrátane cenovej ponuky, potrebnej dokumentácie, demontáže, balenia, odvozu a dokladov podľa konkrétnej zákazky.',
    sections: [
      {
        title: 'Najprv si ujasnime, kde materiál je',
        text: 'Na streche, v obklade a v technickom priestore sa pripravuje odlišná práca. Povedzte nám, o aký objekt ide, ktorá časť sa má riešiť a či sa do materiálu už zasahovalo. Ak jeho zloženie nepoznáte, pokojne nám to napíšte; kvôli prvému dopytu nemusíte odoberať vzorku ani robiť vlastný zásah.\n\nPri firme alebo spravovanej budove doplňte, ktoré priestory ostanú používané a ako sa vstupuje do areálu. Podľa týchto údajov si vyjasníme vhodný rozsah posúdenia a práce.',
        items: ['rodinné domy', 'garáže a hospodárske budovy', 'haly a technické objekty', 'už zložený materiál pripravený na odvoz'],
      },
      {
        title: 'Demontáž na stavbe alebo už zložený materiál',
        text: 'Pri krytine na objekte sa posudzuje aj jej odstránenie, prístup a zabezpečenie pracoviska. Pri už zloženom odpade je dôležité uloženie, stav, množstvo a cesta k miestu nakládky. Ak máte na pozemku oba prípady, rozlíšte ich v dopyte.\n\nMateriál kvôli fotografii neprekladajte a poškodené časti nerozbíjajte na menšie kusy. Na prvý kontakt je vhodnejší opis skutočného stavu než svojpomocná príprava, ktorej následky by sa museli riešiť dodatočne.',
      },
      {
        title: 'Čo si dohodneme pred začatím',
        text: 'Cenová ponuka má pomenovať rozsah demontáže, balenia, odvozu a dokumentácie. Vopred si potvrdíme prístup na pozemok, termín a ďalšie práce, ktoré na zákazku nadväzujú. Obhliadka alebo doplnenie podkladov môžu byť potrebné pri nejasnom materiáli, zložitejšej prevádzke či prístupe.\n\nDoklady po vykonaní práce sa odovzdávajú podľa potvrdeného rozsahu a podmienok zákazky. Ak ich potrebujete na konkrétny účel, povedzte nám to už pri nacenení, aby bolo jasné, čo sa má pripraviť.',
      },
      {
        title: 'Prvý dopyt zvládnete aj bez technickej správy',
        text: 'Pošlite obec, približnú výmeru a kontakt. Pridajte pár viet o materiáli a prístupe. Fotografie sú voliteľné; pri ich príprave sa nevystavujte riziku a nevstupujte na starú krytinu. Ak niektorý údaj neviete, označte ho ako odhad alebo neznámy.\n\nOdoslanie dopytu neznamená automatickú objednávku. Podklady posúdime, vyjasníme si podstatné okolnosti a pripravíme konkrétnu ponuku. Práce sa plánujú až podľa individuálne potvrdenej dohody.',
      },
    ],
    summary: [
      ['Čo riešime', 'materiály s možným obsahom azbestu, strechy, dosky, obklady a pripravený odpad'],
      ['Kde pôsobíme', 'celé Slovensko'],
      ['Čo potrebujeme od vás', 'm2, lokalitu a typ objektu; fotky sú voliteľné'],
      ['Čo zabezpečíme my', 'postup, demontáž, balenie, odvoz a doklady'],
      ['Aký doklad dostanete', 'potvrdenie alebo dokumentáciu podľa rozsahu zákazky'],
      ['Ako rýchlo pripraviť ponuku', 'po odoslaní výmery a lokality; fotky ju môžu spresniť'],
    ],
    faqs: coreFaqs.slice(0, 6),
  },
  eternit: {
    slug: '/likvidacia-eternitu/',
    title: 'Likvidácia eternitu zo striech | Bezpečne a legálne | ASTANA',
    description:
      'Likvidácia eternitu zo striech rodinných domov, garáží, hál a hospodárskych budov. Demontáž, balenie, odvoz a dohodnuté doklady podľa zákazky.',
    h1: 'Likvidácia eternitu zo striech',
    eyebrow: 'Služba',
    quickAnswer:
      `Likvidácia eternitu je odborné odstránenie strešných alebo obkladových dosiek, ktoré môžu obsahovať azbest. Bezpečný postup zahŕňa stabilizáciu materiálu, opatrnú demontáž bez zbytočného lámania, balenie ako nebezpečný odpad a odvoz na určené miesto. Zákazníkovi sa odovzdá ${serviceDocumentationOutcome}.`,
    lead:
      'Eternit sa nemá zbytočne lámať, rezať ani zhadzovať. ASTANA rieši kontrolovanú demontáž, balenie, odvoz a dokumentáciu podľa konkrétnej strechy alebo objektu.',
    sections: [
      {
        title: 'Starú krytinu netreba pred dopytom rozoberať',
        text: 'Ak plánujete výmenu strechy, najprv si dohodnite odstránenie starej krytiny a až potom konkrétnu nadväznosť ďalších prác. Kvôli cenovej ponuke dosky neodoberajte, nebrúste a nelámte. Pri materiáli s obsahom azbestu môže poškodzovanie uvoľňovať vlákna.\n\nNa prvé posúdenie stačia dostupné podklady a opis situácie. Ak neviete, či je krytina azbestová, napíšte to. Fotografia pomôže pri orientácii, ale sama zloženie nepotvrdzuje.',
      },
      {
        title: 'Odstránenie krytiny a nová strecha na seba musia nadväzovať',
        text: 'ASTANA rieši odborné odstránenie azbestového materiálu v dohodnutom rozsahu. Ak už máte strechára, zladíme s ním nadväznosť prác. Napíšte jeho požadovaný termín a to, či ide o potvrdený nástup alebo predbežný plán.\n\nPri samostatne odporučenom strechárovi si jeho ponuku na novú strechu, dohodu aj zodpovednosť za jeho prácu potvrdzujete priamo s ním. Vopred si vyjasnite prevzatie odkrytého objektu a prípadné dočasné zakrytie. Konkrétny rozsah služieb ASTANY určuje naša cenová ponuka.',
      },
      {
        title: 'Ako opísať strechu pre cenovú ponuku',
        text: 'Uveďte obec, približnú plochu krytiny a typ objektu. Plocha šikmej strechy nie je automaticky rovnaká ako pôdorys domu. Ak máte iba rozmery domu alebo starý rozpočet, označte, odkiaľ údaj pochádza.\n\nPomôže informácia o výške, príjazde a priestore pri budove. Fotky celej strechy a dvora sú voliteľné. Urobte ich z bezpečného miesta; na starú krytinu kvôli foteniu ani meraniu nevstupujte.',
      },
    ],
    summary: [
      ['Čo riešime', 'eternitové strechy, šablóny a azbestocementové dosky'],
      ['Kde pôsobíme', 'celé Slovensko'],
      ['Čo potrebujeme od vás', 'výmeru, lokalitu a informáciu, či máte strechára; fotky sú voliteľné'],
      ['Čo zabezpečíme my', 'bezpečný postup, demontáž, balenie, odvoz a doklady'],
      ['Aký doklad dostanete', 'potvrdenie alebo dokumentáciu po legálnej likvidácii'],
      ['Ako rýchlo pripraviť ponuku', 'odošlite m2 a lokalitu; fotky môžu ponuku spresniť'],
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
    localNote: 'Poprad je sídlom ASTANY. Pri dopyte uveďte obec, približnú výmeru, stav materiálu a preferovaný termín, aby sme vedeli naplánovať ďalší postup.',
    coverageHeading: 'Poprad a širšie okolie',
    coverageAreas: ['Poprad', 'Svit', 'Vysoké Tatry', 'Kežmarok', 'Levoča'],
    requestChecklist: [
      'obec alebo adresu objektu a približnú výmeru v m2',
      'či je materiál na streche, fasáde alebo už bezpečne uložený',
      'preferovaný termín a informáciu, či po demontáži nadväzuje strechár',
    ],
    planningPoints: [
      ['Výjazd zo sídla firmy', 'ASTANA sídli v Poprade. Termín aj poradie zákaziek však vždy potvrdzujeme podľa rozsahu práce, pripravenosti stavby a aktuálnej kapacity.'],
      ['Materiál na objekte alebo na zemi', 'Uveďte, či je materiál ešte na streche alebo fasáde, prípadne už zložený. Od toho sa odvíja potrebný postup, manipulácia aj nakládka.'],
      ['Nadväzujúci strechár', 'Ak po demontáži pokračuje pokrývač, napíšte jeho plánovaný termín už v prvom dopyte. Pomôže nám to zosúladiť práce bez zbytočného čakania.'],
    ],
    relatedSlugs: ['presov', 'kosice', 'zilina'],
  },
  {
    slug: 'kosice',
    name: 'Košice',
    area: 'Košiciach a Košickom kraji',
    title: 'Likvidácia azbestu a eternitu Košice | ASTANA',
    description: 'Likvidácia azbestu a eternitu v Košiciach a Košickom kraji vrátane dokumentácie, demontáže, balenia, odvozu a dokladov.',
    localNote: 'Pri dopyte z Košíc a okolia uveďte presnú obec, prístup k objektu a prípadné časové obmedzenia. Pomôže to posúdiť logistiku výjazdu.',
    coverageHeading: 'Košický kraj',
    coverageAreas: ['Gelnica', 'Košice I–IV', 'Košice-okolie', 'Michalovce', 'Rožňava', 'Sobrance', 'Spišská Nová Ves', 'Trebišov'],
    requestChecklist: [
      'presnú obec alebo okres, aby sme vedeli posúdiť trasu výjazdu',
      'možnosť príjazdu pracovného vozidla a prístup k objektu',
      'časové obmedzenia a požadovanú nadväznosť ďalších prác',
    ],
    planningPoints: [
      ['Presná obec rozhoduje o trase', 'Košický kraj zahŕňa viac vzdialených okresov. Obec alebo mestská časť nám umožní realisticky posúdiť výjazd a navrhnúť termín.'],
      ['Príjazd a miesto nakládky', 'Napíšte, či sa pracovné vozidlo dostane priamo k objektu a kde je možné bezpečne manipulovať so zabaleným materiálom.'],
      ['Prevádzkové obmedzenia', 'Pri firme, hale alebo objekte v prevádzke uveďte čas, keď je možný prístup. Konkrétny režim dohodneme pred potvrdením zákazky.'],
    ],
    relatedSlugs: ['presov', 'poprad', 'banska-bystrica'],
  },
  {
    slug: 'presov',
    name: 'Prešov',
    area: 'Prešove a Prešovskom kraji',
    title: 'Likvidácia azbestu a eternitu Prešov | ASTANA',
    description: 'Odborná likvidácia azbestu a eternitu v Prešove a Prešovskom kraji. Na ponuku stačí m2 a lokalita; fotky sú voliteľné.',
    localNote: 'Prešov a okolie obsluhujeme z nášho sídla v Poprade. Pošlite približnú výmeru a informáciu, či potrebujete práce zladiť so strechárom.',
    coverageHeading: 'Prešovský kraj',
    coverageAreas: ['Bardejov', 'Humenné', 'Kežmarok', 'Levoča', 'Medzilaborce', 'Poprad', 'Prešov', 'Sabinov', 'Snina', 'Stará Ľubovňa', 'Stropkov', 'Svidník', 'Vranov nad Topľou'],
    requestChecklist: [
      'obec alebo okres a typ objektu',
      'približnú výmeru a stav azbestocementového materiálu',
      'či treba termín demontáže koordinovať s pokrývačmi',
    ],
    planningPoints: [
      ['Výjazd plánujeme z Popradu', 'Pri dopyte z Prešovského kraja uveďte konkrétnu obec. Podľa nej, rozsahu a dostupnej kapacity potvrdíme logistiku aj termín.'],
      ['Rozsah a stav materiálu', 'Pomôže odhad výmery a informácia, či je krytina celá, poškodená alebo už zložená. Fotografie sú voliteľné, no môžu spresniť prvé posúdenie.'],
      ['Koordinácia so strechárom', 'Ak má po odstránení eternitu hneď pokračovať nová strecha, uveďte dohodnutý termín pokrývača. Nadväznosť prác potvrdíme spoločne.'],
    ],
    relatedSlugs: ['poprad', 'kosice', 'zilina'],
  },
  {
    slug: 'zilina',
    name: 'Žilina',
    area: 'Žiline a Žilinskom kraji',
    title: 'Likvidácia azbestu a eternitu Žilina | ASTANA',
    description: 'Likvidácia azbestu a eternitu v Žiline a Žilinskom kraji. Demontáž, balenie, odvoz a dohodnuté doklady podľa zákazky.',
    localNote: 'Pri dopyte zo Žiliny a okolia popíšte prístup na pozemok, približný sklon strechy a to, či má po odstránení nadväzovať pokládka novej krytiny.',
    coverageHeading: 'Žilinský kraj',
    coverageAreas: ['Bytča', 'Čadca', 'Dolný Kubín', 'Kysucké Nové Mesto', 'Liptovský Mikuláš', 'Martin', 'Námestovo', 'Ružomberok', 'Turčianske Teplice', 'Tvrdošín', 'Žilina'],
    requestChecklist: [
      'presnú obec a informáciu o prístupe na pozemok',
      'približný sklon, výšku a výmeru strechy',
      'či má po odstránení bezprostredne nadväzovať nová krytina',
    ],
    planningPoints: [
      ['Prístup k stavbe', 'Ak je objekt v užšej ulici alebo mimo hlavnej cesty, opíšte možnosť príjazdu a priestor pri budove. Pomôže to pripraviť vhodnú logistiku.'],
      ['Výška a sklon strechy', 'Pri strechách v Žilinskom kraji potrebujeme poznať približnú výšku, sklon a výmeru. Tieto údaje vplývajú na prípravu aj nacenenie.'],
      ['Nová krytina po demontáži', 'Napíšte, či máte dohodnutého strechára a jeho termín. Odstránenie azbestu a ďalšie strešné práce plánujeme ako dve nadväzujúce činnosti.'],
    ],
    relatedSlugs: ['trencin', 'banska-bystrica', 'presov'],
  },
  {
    slug: 'banska-bystrica',
    name: 'Banská Bystrica',
    area: 'Banskej Bystrici a Banskobystrickom kraji',
    title: 'Likvidácia azbestu a eternitu Banská Bystrica | ASTANA',
    description: 'Likvidácia azbestu a eternitu v Banskej Bystrici a okolí. Cenová ponuka podľa výmery, prístupu, lokality a typu materiálu.',
    localNote: 'Pri dopyte z Banskobystrického kraja uveďte konkrétnu obec, približnú výmeru a prístup k objektu. Podľa týchto údajov pripravíme posúdenie ďalšieho postupu.',
    coverageHeading: 'Banskobystrický kraj',
    coverageAreas: ['Banská Bystrica', 'Banská Štiavnica', 'Brezno', 'Detva', 'Krupina', 'Lučenec', 'Poltár', 'Revúca', 'Rimavská Sobota', 'Veľký Krtíš', 'Zvolen', 'Žarnovica', 'Žiar nad Hronom'],
    requestChecklist: [
      'konkrétnu obec alebo okres a typ objektu',
      'približnú výmeru a miesto, kde sa materiál nachádza',
      'popis príjazdu k objektu a priestoru na bezpečnú manipuláciu',
    ],
    planningPoints: [
      ['Obec aj okres', 'Banskobystrický kraj je územne rozsiahly. Uvedenie obce aj okresu nám pomôže správne posúdiť trasu a termín výjazdu.'],
      ['Príjazd v členitom teréne', 'Ak vedie k objektu úzka, strmá alebo inak obmedzená cesta, popíšte ju v dopyte. Potrebujeme vedieť, kam sa bezpečne dostane pracovné vozidlo.'],
      ['Miesto uloženia materiálu', 'Rozlišujeme materiál na streche, fasáde a už zložený odpad. Uveďte jeho polohu a približný rozsah, aby ponuka počítala so správnou manipuláciou.'],
    ],
    relatedSlugs: ['zilina', 'trencin', 'nitra'],
  },
  {
    slug: 'bratislava',
    name: 'Bratislava',
    area: 'Bratislave a Bratislavskom kraji',
    title: 'Likvidácia azbestu a eternitu Bratislava | ASTANA',
    description: 'Odborná likvidácia azbestu a eternitu v Bratislave a Bratislavskom kraji vrátane podkladov, odvozu a potvrdenia.',
    localNote: 'Pri dopyte z Bratislavy uveďte typ objektu, možnosti prístupu a prípadné obmedzenia v čase alebo pri parkovaní.',
    coverageHeading: 'Bratislavský kraj',
    coverageAreas: ['Bratislava I–V', 'Malacky', 'Pezinok', 'Senec'],
    requestChecklist: [
      'mestskú časť alebo obec a typ objektu',
      'možnosť príjazdu a parkovania pracovného vozidla',
      'prípadné časové alebo prevádzkové obmedzenia pri objekte',
    ],
    planningPoints: [
      ['Mestská časť a parkovanie', 'Pri bratislavskom dopyte uveďte mestskú časť alebo obec a možnosť státia pracovného vozidla. Samotný názov Bratislava na plánovanie výjazdu nestačí.'],
      ['Čas prístupu k objektu', 'Ak je vstup do areálu, dvora alebo ulice časovo obmedzený, napíšte dostupné intervaly. Reálny režim prác dohodneme pred potvrdením termínu.'],
      ['Priestor na bezpečnú manipuláciu', 'Pomôže informácia, kde sa dá pripraviť a naložiť zabalený materiál bez blokovania vstupu, prevádzky alebo susedného pozemku.'],
    ],
    relatedSlugs: ['trnava', 'nitra', 'trencin'],
  },
  {
    slug: 'nitra',
    name: 'Nitra',
    area: 'Nitre a Nitrianskom kraji',
    title: 'Likvidácia azbestu a eternitu Nitra | ASTANA',
    description: 'Likvidácia azbestu a eternitu v Nitre a Nitrianskom kraji. Bezpečná demontáž, balenie, odvoz a doklady.',
    localNote: 'Pri dopyte z Nitrianskeho kraja napíšte, či je materiál ešte na streche alebo už zložený. Fotky z viacerých strán sú voliteľné a pomôžu ponuku spresniť.',
    coverageHeading: 'Nitriansky kraj',
    coverageAreas: ['Komárno', 'Levice', 'Nitra', 'Nové Zámky', 'Šaľa', 'Topoľčany', 'Zlaté Moravce'],
    requestChecklist: [
      'obec alebo okres a približnú výmeru',
      'či je materiál ešte na objekte alebo už zložený',
      'prístup k materiálu; voliteľné fotky z viacerých strán pomôžu ponuku spresniť',
    ],
    planningPoints: [
      ['Strecha alebo už zložený materiál', 'Uveďte, či ide o demontáž krytiny, materiál na fasáde alebo už zložené dosky. Každý stav vyžaduje iný rozsah prípravy a manipulácie.'],
      ['Prístup k objektu', 'Pri dome, hospodárskej budove alebo hale popíšte príjazd a voľný priestor pri materiáli. Podľa toho vieme pripraviť realistický postup.'],
      ['Fotografie ako pomôcka', 'Fotky nie sú podmienkou dopytu. Ak ich máte, záber celého objektu, materiálu a prístupu môže znížiť počet doplňujúcich otázok.'],
    ],
    relatedSlugs: ['trnava', 'trencin', 'banska-bystrica'],
  },
  {
    slug: 'trnava',
    name: 'Trnava',
    area: 'Trnave a Trnavskom kraji',
    title: 'Likvidácia azbestu a eternitu Trnava | ASTANA',
    description: 'Odborná likvidácia azbestu a eternitu v Trnave a Trnavskom kraji. Ponuka podľa m2, lokality a prístupu; fotky sú voliteľné.',
    localNote: 'Pri dopyte z Trnavy a okolia opíšte prístup vozidla k objektu a uveďte, či potrebujete termín zladiť s prácou strechárov.',
    coverageHeading: 'Trnavský kraj',
    coverageAreas: ['Dunajská Streda', 'Galanta', 'Hlohovec', 'Piešťany', 'Senica', 'Skalica', 'Trnava'],
    requestChecklist: [
      'obec alebo okres a približnú výmeru',
      'prístup pracovného vozidla k objektu',
      'či treba demontáž termínovo zladiť s pokrývačmi',
    ],
    planningPoints: [
      ['Obec a dostupnosť objektu', 'Pri dopyte z Trnavského kraja uveďte obec alebo okres a možnosť príjazdu k stavbe. Tieto údaje potrebujeme skôr než potvrdíme výjazd.'],
      ['Termín pokrývačov', 'Ak sa po odstránení eternitu mení strecha, pošlite plánovaný termín strechára. Nadväznosť prác dohodneme podľa rozsahu a kapacity.'],
      ['Stav a poloha materiálu', 'Napíšte, či je materiál ešte na streche, na inom objekte alebo už zložený. Pri prvom posúdení stačí približná výmera.'],
    ],
    relatedSlugs: ['bratislava', 'nitra', 'trencin'],
  },
  {
    slug: 'trencin',
    name: 'Trenčín',
    area: 'Trenčíne a Trenčianskom kraji',
    title: 'Likvidácia azbestu a eternitu Trenčín | ASTANA',
    description: 'Odborná likvidácia azbestu a eternitu v Trenčíne a Trenčianskom kraji. Ponuka podľa výmery, prístupu a rozsahu zákazky.',
    localNote: 'Pri dopyte z Trenčianskeho kraja uveďte konkrétnu obec, stav materiálu a prístup k objektu. Ak po demontáži nadväzuje pokládka novej krytiny, napíšte aj plánovaný termín strechára.',
    coverageHeading: 'Trenčiansky kraj',
    coverageAreas: ['Bánovce nad Bebravou', 'Ilava', 'Myjava', 'Nové Mesto nad Váhom', 'Partizánske', 'Považská Bystrica', 'Prievidza', 'Púchov', 'Trenčín'],
    requestChecklist: [
      'konkrétnu obec alebo okres a približnú výmeru',
      'stav materiálu a možnosti bezpečného prístupu',
      'plánovaný termín strechára, ak má hneď nadväzovať nová krytina',
    ],
    planningPoints: [
      ['Konkrétna obec a okres', 'Pri plánovaní v Trenčianskom kraji potrebujeme presnejšiu lokalitu než iba názov kraja. Obec a okres určia trasu aj reálnu dostupnosť termínu.'],
      ['Prístup a poloha objektu', 'Ak je cesta úzka, pozemok svahovitý alebo je pri objekte málo priestoru, uveďte to v dopyte. Logistiku potvrdíme podľa skutočných podmienok.'],
      ['Nadväzujúca nová strecha', 'Pri výmene krytiny napíšte, kedy má prísť strechár. Termín demontáže potvrdíme až po overení kapacity a nadväznosti prác.'],
    ],
    relatedSlugs: ['trnava', 'zilina', 'banska-bystrica'],
  },
] as const;

export const articles = adviceArticles;

export type ArticleEditorialSource = {
  title: string;
  publisher: string;
  url: string;
  supports: string;
};

export const articleEditorial = {
  contentUpdatedAt: '2026-10-27',
  contentUpdatedLabel: '27. októbra 2026',
  scopeNote:
    'Oficiálne zdroje podporujú zdravotné, právne a odpadové tvrdenia. Praktické údaje k výmere, fotkám a cenovej ponuke vychádzajú z pracovného postupu ASTANA a nenahrádzajú individuálne posúdenie konkrétnej stavby.',
  methodologyNote:
    'Tento článok opisuje praktický postup ASTANA pri príprave cenovej ponuky. Neodvoláva sa na externý cenník ani normu; konkrétny rozsah a cena sa určujú až podľa údajov o stavbe.',
} as const;

const whoAsbestosSource = {
  title: 'Asbestos',
  publisher: 'Svetová zdravotnícka organizácia (WHO)',
  url: 'https://www.who.int/news-room/fact-sheets/asbestos',
  supports: 'Zdravotné riziká azbestu a potrebu obmedziť expozíciu pri odstraňovaní.',
} as const satisfies ArticleEditorialSource;

const slovLexAsbestosSource = {
  title: 'Zákon č. 355/2007 Z. z., § 41 — časová verzia účinná od 1. augusta 2026',
  publisher: 'Slov-Lex',
  url: 'https://static.slov-lex.sk/static/SK/ZZ/2007/355/20260801.print.html',
  supports: 'Právny rámec odstraňovania azbestu zo stavieb na Slovensku.',
} as const satisfies ArticleEditorialSource;

const euConstructionWasteSource = {
  title: 'Construction and demolition waste',
  publisher: 'Európska komisia',
  url: 'https://environment.ec.europa.eu/topics/waste-and-recycling/construction-and-demolition-waste_en',
  supports: 'Nakladanie so stavebným odpadom a oddelené riešenie nebezpečných zložiek vrátane azbestu.',
} as const satisfies ArticleEditorialSource;

export const articleEditorialBySlug: Record<
  (typeof articles)[number]['slug'],
  { sources: readonly ArticleEditorialSource[] }
> = {
  'co-je-eternit-a-kedy-obsahuje-azbest': { sources: [whoAsbestosSource, slovLexAsbestosSource] },
  'preco-neodstranovat-eternit-svojpomocne': { sources: [whoAsbestosSource, slovLexAsbestosSource] },
  'kolko-stoji-likvidacia-azbestu': { sources: [] },
  'ake-doklady-dostanete-po-likvidacii-azbestu': { sources: [slovLexAsbestosSource, euConstructionWasteSource] },
  'ako-zmerat-strechu-pre-cenovu-ponuku': { sources: [] },
  'co-poslat-pre-nacenenie-likvidacie-eternitu': { sources: [] },
  'azbest-v-interieri-vs-exterieri': { sources: [whoAsbestosSource, slovLexAsbestosSource] },
  'odvoz-a-balenie-azbestoveho-odpadu': { sources: [euConstructionWasteSource, slovLexAsbestosSource] },
};
