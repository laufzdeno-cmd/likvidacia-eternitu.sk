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
      'Pri materiáloch s možným obsahom azbestu nejde iba o zloženie krytiny. Treba riešiť bezpečnú manipuláciu, balenie, odvoz ako nebezpečný odpad a doklady o likvidácii.',
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
        text: 'Pre rýchle nacenenie pošlite približnú výmeru v m2, lokalitu, typ objektu a kontakt, na ktorom vás vieme zastihnúť. Fotky materiálu sú voliteľné, ale pomôžu ponuku spresniť.',
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
        title: 'Prečo postupovať opatrne',
        text: 'Starší eternit môže obsahovať azbest. Riziko vzniká najmä pri poškodení materiálu, preto sa má manipulácia robiť kontrolovane a bez zbytočného prachu.',
      },
      {
        title: 'Čo ASTANA zabezpečí',
        text: 'Zabezpečíme nacenenie, potrebné podklady, stabilizáciu materiálu, demontáž, balenie, odvoz a potvrdenie alebo súvisiacu dokumentáciu.',
      },
      {
        title: 'Ako poslať údaje a voliteľné fotky',
        text: 'Do formulára uveďte približnú výmeru strechy v m2, obec alebo okres a typ objektu. Ak máte fotky celej strechy, detailu materiálu alebo prístupu k objektu, môžete ich priložiť na spresnenie ponuky.',
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

export const articles = [
  {
    slug: 'co-je-eternit-a-kedy-obsahuje-azbest',
    title: 'Čo je eternit a kedy môže obsahovať azbest',
    description: 'Praktické vysvetlenie, čo je eternit, prečo sa pri starších materiáloch rieši azbest a ako postupovať pri podozrení.',
    image: '/og/homepage.jpg',
    quickAnswer:
      'Eternit je bežné označenie pre azbestocementové alebo vláknocementové dosky a krytiny. Staršie materiály môžu obsahovať azbest, preto sa pri poškodení, demontáži alebo odvoze odporúča odborné posúdenie a bezpečný postup.',
    body: [
      ['Prečo na veku záleží', 'Pri starších strechách a obkladoch je bezpečnejšie počítať s možnosťou obsahu azbestu, kým sa materiál neposúdi.'],
      ['Čo si všimnúť', 'Dôležitý je typ dosiek, stav materiálu, rozsah poškodenia, prístup k streche a to, či sa s materiálom už manipulovalo.'],
      ['Ako postupovať', 'Materiál zbytočne nelámte ani nerežte. Pošlite výmeru a lokalitu; voliteľné fotky pomôžu spresniť ďalší postup.'],
    ],
    faqs: [
      { question: 'Môže starší eternit obsahovať azbest?', answer: 'Pri starších strechách a obkladoch je bezpečnejšie počítať s možnosťou obsahu azbestu, kým sa materiál neposúdi.' },
      { question: 'Čo poslať na prvé posúdenie eternitu?', answer: 'Pošlite približnú výmeru a lokalitu. Fotky sú voliteľné, ale pomôžu posúdiť typ dosiek, stav materiálu, rozsah poškodenia a prístup k streche.' },
    ],
  },
  {
    slug: 'preco-neodstranovat-eternit-svojpomocne',
    title: 'Prečo neodstraňovať eternit svojpomocne',
    description: 'Prehľad rizík pri svojpomocnom odstraňovaní eternitu a dôvody, prečo je dôležitý odborný postup.',
    image: '/og/postup.jpg',
    quickAnswer:
      'Svojpomocné odstraňovanie eternitu je rizikové najmä pri lámaní, rezaní, zhadzovaní a nesprávnom odpade. Bezpečný postup rieši stabilizáciu, kontrolovanú demontáž, balenie, odvoz ako nebezpečný odpad a doklad o likvidácii.',
    body: [
      ['Riziko prachu', 'Pri poškodení materiálu sa môže zvyšovať riziko uvoľňovania vlákien a prachu.'],
      ['Riziko odpadu', 'Azbestový odpad nepatrí do bežného odpadu a má sa riešiť preukázateľne.'],
      ['Riziko chaosu na stavbe', 'Zhadzovanie krytiny komplikuje balenie, upratovanie aj nadväznosť ďalších prác.'],
    ],
    faqs: [
      { question: 'Prečo eternit nelámať, nerežať ani nezhadzovať?', answer: 'Pri poškodení materiálu sa môže zvyšovať riziko uvoľňovania vlákien a prachu. Zhadzovanie navyše komplikuje balenie, upratovanie aj nadväznosť ďalších prác.' },
      { question: 'Patrí azbestový odpad do bežného odpadu?', answer: 'Nie. Azbestový odpad sa má riešiť preukázateľne, vrátane bezpečného balenia a odvozu určeným spôsobom.' },
    ],
  },
  {
    slug: 'kolko-stoji-likvidacia-azbestu',
    title: 'Koľko stojí likvidácia azbestu',
    description: 'Cena likvidácie azbestu závisí od výmery, prístupu, typu materiálu, lokality a dokumentácie.',
    image: '/og/cena-strecha-realizacia.jpg',
    quickAnswer:
      'Cena likvidácie azbestu je individuálna. Najviac ju ovplyvňuje výmera, typ a stav materiálu, výška objektu, prístup, lokalita, rozsah dokumentácie a objem odpadu. Na prvú ponuku stačí m2 a lokalita; fotky sú voliteľné.',
    body: [
      ['Prečo nie je univerzálny cenník', 'Rovnaká výmera môže mať rozdielnu náročnosť podľa prístupu, výšky a stavu krytiny.'],
      ['Čo poslať', 'Uveďte m2, obec, typ objektu a informáciu, či je materiál ešte na streche. Fotky sú voliteľné a pomôžu ponuku spresniť.'],
      ['Čo má ponuka obsahovať', 'Ponuka má jasne pomenovať demontáž, balenie, odvoz, dokumentáciu a doklad po likvidácii.'],
    ],
    faqs: [
      { question: 'Prečo sa nedá určiť jedna cena likvidácie azbestu?', answer: 'Rovnaká výmera môže mať rozdielnu náročnosť podľa prístupu, výšky a stavu krytiny. Cenu ovplyvňuje aj typ materiálu, lokalita, rozsah dokumentácie a objem odpadu.' },
      { question: 'Čo poslať, aby ste pripravili cenovú ponuku?', answer: 'Uveďte približnú výmeru v m2, obec, typ objektu a informáciu, či je materiál ešte na streche. Fotky sú voliteľné a pomôžu ponuku spresniť.' },
    ],
  },
  {
    slug: 'ake-doklady-dostanete-po-likvidacii-azbestu',
    title: 'Aké doklady dostanete po likvidácii azbestu',
    description: 'Vysvetlenie, prečo je po likvidácii azbestu dôležité potvrdenie alebo súvisiaca dokumentácia.',
    image: '/og/postup.jpg',
    quickAnswer:
      'Po legálnej likvidácii azbestu má zákazník dostať potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu zákazky. Doklad pomáha preukázať, že s odpadom sa nakladalo určeným spôsobom a materiál neskončil mimo legálneho procesu.',
    body: [
      ['Prečo doklady chrániť', 'Pri budúcom predaji, kontrole alebo správe objektu je dobré mať preukázateľný záznam o likvidácii.'],
      ['Čo sa líši podľa zákazky', 'Rozsah dokumentácie sa môže líšiť podľa objektu, materiálu, objemu a postupu.'],
      ['Kedy sa doklady odovzdajú', 'Doklady sa odovzdávajú po ukončení prác a podľa dohodnutého rozsahu zákazky.'],
    ],
    faqs: [
      { question: 'Aké doklady dostanem po likvidácii azbestu?', answer: 'Po legálnej likvidácii dostanete potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu zákazky.' },
      { question: 'Kedy sa odovzdávajú doklady o likvidácii?', answer: 'Doklady sa odovzdávajú po ukončení prác a podľa dohodnutého rozsahu zákazky. Ich rozsah sa môže líšiť podľa objektu, materiálu, objemu a postupu.' },
    ],
  },
  {
    slug: 'ako-zmerat-strechu-pre-cenovu-ponuku',
    title: 'Ako zmerať strechu pre cenovú ponuku',
    description: 'Jednoduchý postup, ako pripraviť približnú výmeru strechy v m2 pre nacenenie likvidácie eternitu.',
    image: '/og/homepage.jpg',
    quickAnswer:
      'Pre prvú cenovú ponuku stačí približná výmera strechy v m2. Ak presné rozmery nepoznáte, pošlite odhad, rozmery pôdorysu a počet strán strechy. Fotky sú voliteľné a pomôžu rozsah spresniť.',
    body: [
      ['Začnite odhadom', 'Pri sedlovej streche pomôže dĺžka a šírka jednej strany, prípadne rozmery domu a sklon.'],
      ['Fotky sú voliteľné', 'Ak ich máte, fotky celej strechy a detail materiálu pomôžu viac než nepresný výpočet.'],
      ['Uveďte nejasnosti', 'Ak si nie ste istí, napíšte, že ide o odhad. Ponuka sa dá spresniť po kontrole údajov.'],
    ],
    faqs: [
      { question: 'Čo ak nepoznám presnú výmeru strechy?', answer: 'Na prvú cenovú ponuku stačí približný odhad. Uveďte rozmery pôdorysu a počet strán strechy; voliteľné fotky pomôžu rozsah spresniť.' },
      { question: 'Aké rozmery pomôžu pri odhade sedlovej strechy?', answer: 'Pomôže dĺžka a šírka jednej strany, prípadne rozmery domu a sklon strechy. Fotky sú voliteľné, ale často pomôžu viac ako nepresný výpočet.' },
    ],
  },
  {
    slug: 'co-poslat-pre-nacenenie-likvidacie-eternitu',
    title: 'Čo poslať pre nacenenie likvidácie eternitu',
    description: 'Prehľad údajov, ktoré urýchlia cenovú ponuku na likvidáciu eternitu.',
    image: '/og/realizacie.jpg',
    quickAnswer:
      'Pre rýchle nacenenie likvidácie eternitu pošlite lokalitu, približnú výmeru v m2, typ objektu, informáciu o prístupe a kontakt. Fotky sú voliteľné. Ak niečo neviete, uveďte odhad.',
    body: [
      ['Základné údaje', 'Obec alebo okres, výmera, typ objektu a kontakt sú základ pre prvé posúdenie.'],
      ['Fotky sú voliteľné', 'Ak ich máte, pomôže celkový záber strechy, detail krytiny, okolie objektu a prípadné miesto nakládky.'],
      ['Dôležité okolnosti', 'Napíšte, či je materiál na streche alebo už zložený a či treba práce zladiť so strechárom.'],
    ],
    faqs: [
      { question: 'Aké údaje potrebujete na nacenenie likvidácie eternitu?', answer: 'Základom je obec alebo okres, približná výmera, typ objektu a kontakt. Pomôže aj informácia o prístupe a o tom, či je materiál na streche alebo už zložený.' },
      { question: 'Aké fotky priložiť k dopytu?', answer: 'Fotky sú voliteľné. Ak ich máte, priložte celkový záber strechy, detail krytiny, okolie objektu a prípadné miesto nakládky.' },
    ],
  },
  {
    slug: 'azbest-v-interieri-vs-exterieri',
    title: 'Azbest v interiéri a exteriéri: v čom je rozdiel',
    description: 'Vecné porovnanie prístupu k materiálom s možným obsahom azbestu v interiéri a exteriéri.',
    image: '/og/faq.jpg',
    quickAnswer:
      'Azbest v interiéri a exteriéri sa posudzuje podľa typu materiálu, stavu, prístupu a rizika poškodenia. V oboch prípadoch je dôležitý kontrolovaný postup, obmedzenie prachu, bezpečné balenie odpadu a preukázateľná likvidácia.',
    body: [
      ['Exteriér', 'Pri strechách je častou témou výška, sklon, počasie, prístup a nadväznosť strechárskych prác.'],
      ['Interiér', 'V interiéri je dôležité riešiť kontrolu priestoru, prístup a ochranu okolia.'],
      ['Spoločné pravidlo', 'Materiál zbytočne nepoškodzujte a nechajte si navrhnúť bezpečný postup.'],
    ],
    faqs: [
      { question: 'Čo sa posudzuje pri azbeste v exteriéri?', answer: 'Pri strechách sa posudzuje najmä výška, sklon, počasie, prístup a nadväznosť strechárskych prác.' },
      { question: 'Čo je dôležité pri materiáli s azbestom v interiéri?', answer: 'V interiéri je dôležité riešiť kontrolu priestoru, prístup a ochranu okolia. Materiál zbytočne nepoškodzujte a nechajte si navrhnúť bezpečný postup.' },
    ],
  },
  {
    slug: 'odvoz-a-balenie-azbestoveho-odpadu',
    title: 'Odvoz a balenie azbestového odpadu',
    description: 'Ako premýšľať o balení a odvoze azbestového odpadu, aby bol postup bezpečný a preukázateľný.',
    image: '/og/cena.jpg',
    quickAnswer:
      'Azbestový odpad má byť po demontáži bezpečne zabalený, označený alebo pripravený spôsobom vhodným pre odvoz na určené miesto. Dôležité je, aby materiál nezostal voľne uložený a zákazník mal doklad o legálnej likvidácii.',
    body: [
      ['Balenie nie je detail', 'Správne balenie znižuje riziko zbytočnej manipulácie a uľahčuje odvoz.'],
      ['Prístup k odpadu', 'Pri už zloženom materiáli je dôležité vedieť, kde leží a či sa k nemu dá dostať technikou.'],
      ['Doklad po ukončení', 'Po odvoze má zákazník dostať potvrdenie alebo dokumentáciu podľa rozsahu zákazky.'],
    ],
    faqs: [
      { question: 'Prečo je dôležité bezpečné balenie azbestového odpadu?', answer: 'Správne balenie znižuje riziko zbytočnej manipulácie a uľahčuje odvoz. Materiál nemá zostať voľne uložený.' },
      { question: 'Čo treba vedieť pri odvoze už zloženého materiálu?', answer: 'Dôležité je vedieť, kde materiál leží a či sa k nemu dá dostať technikou. Po odvoze má zákazník dostať potvrdenie alebo dokumentáciu podľa rozsahu zákazky.' },
    ],
  },
] as const;

export type ArticleEditorialSource = {
  title: string;
  publisher: string;
  url: string;
  supports: string;
};

export const articleEditorial = {
  contentUpdatedAt: '2026-10-08',
  contentUpdatedLabel: '8. októbra 2026',
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
