import { pagePhotoId, pagePhotoIds } from '../content/public-photo-assignments';

export type AzbestCategory =
  | 'rodinne-domy'
  | 'hospodarske-budovy'
  | 'priemysel'
  | 'interier'
  | 'balenie-odvoz'
  | 'strechari';

export type AzbestReference = {
  id: string;
  webp: string;
  jpg: string;
  alt: string;
  title: string;
  category: AzbestCategory;
  recommendedUse: string;
  priority: boolean;
};

const asset = (
  number: number,
  title: string,
  category: AzbestCategory,
  recommendedUse: string,
  alt: string,
  priority = false,
): AzbestReference => {
  const id = `azbest-${String(number).padStart(3, '0')}`;

  return {
    id,
    webp: `/assets/azbest/webp/${id}.webp`,
    jpg: `/assets/azbest/jpg/${id}.jpg`,
    alt,
    title,
    category,
    recommendedUse,
    priority,
  };
};

export const azbestReferences = [
  asset(87, "Stabilizácia eternitovej strechy", "rodinne-domy", "/", "Pracovník ASTANA stabilizuje strešnú krytinu pred ďalšou manipuláciou.", true),
  asset(164, "Drevenica s ohraničeným pracoviskom", "rodinne-domy", "/", "Drevenica a výstražnou páskou ohraničené pracovisko počas realizácie ASTANA.", true),
  asset(51, "Pracovník pri stabilizácii krytiny", "rodinne-domy", "/postup/", "Pracovník ASTANA v ochrannom obleku pri ošetrovaní strešnej krytiny.", true),
  asset(68, "Pracovisko pri rodinnom dome", "rodinne-domy", "/postup/", "Rodinný dom s rebríkom, pracovným vozidlom a materiálom počas prác ASTANA.", true),
  asset(135, "Demontáž strechy na drevenici", "rodinne-domy", "/poradna/preco-neodstranovat-eternit-svojpomocne/", "Pracovníci v ochranných oblekoch pri demontáži strešnej krytiny na drevenici.", false),
  asset(69, "Lešenie pri rodinnom dome", "rodinne-domy", "/likvidacia-azbestu-trencin/", "Prístupové lešenie pri fasáde rodinného domu na realizácii ASTANA.", false),
  asset(134, "Rodinný dom s lešením", "rodinne-domy", "/poradna/kolko-stoji-likvidacia-azbestu/", "Rodinný dom s lešením a ohraničeným priestorom pri strešných prácach ASTANA.", false),
  asset(110, "Práce pri veľkom priemyselnom objekte", "priemysel", "/", "Pracovné vozidlo ASTANA pred veľkým priemyselným objektom s odkrytou konštrukciou.", true),
  asset(91, "Materiál pri pracovnom vozidle", "balenie-odvoz", "/poradna/odvoz-a-balenie-azbestoveho-odpadu/", "Materiál a obaly pri nákladnom vozidle počas realizácie ASTANA.", true),
  asset(171, "Sanácia v technickom priestore", "interier", "/poradna/azbest-v-interieri-vs-exterieri/", "Pracovníci ASTANA v ochranných oblekoch pri práci medzi potrubiami v technickom priestore.", false),
  asset(160, "Práca v technickom priestore", "interier", "/realizacie/", "Pracovník ASTANA v ochrannom obleku pri potrubiach v technickom priestore.", false),
  asset(130, "Stabilizácia vlnitej krytiny", "rodinne-domy", "/poradna/co-je-eternit-a-kedy-obsahuje-azbest/", "Detail ošetrovania povrchu vlnitej strešnej krytiny počas prác ASTANA.", false),
  asset(132, "Ošetrenie krytiny pred demontážou", "rodinne-domy", "/faq/", "Príprava povrchu staršej strešnej krytiny pri práci ASTANA.", false),
  asset(65, "Pracovné vozidlo pred objektom", "priemysel", "/kde-posobime/", "Pracovné vozidlo ASTANA pred vstupom do rozsiahleho objektu.", false),
  asset(57, "Strešné práce na dlhom objekte", "hospodarske-budovy", "/", "Dlhá hospodárska budova s pracovníkmi v ochranných oblekoch pri strešných prácach.", false),
  asset(62, 'Priemyselné veže a technologické silá', 'priemysel', 'priemysel, veže, galéria', 'Priemyselné technologické veže a silá pri objekte s materiálmi obsahujúcimi azbest', false),
  asset(63, "Priemyselný areál s technologickou vežou", "priemysel", "/realizacie/", "Priemyselný areál s technologickou vežou a vymedzeným pracovným priestorom.", false),
  asset(106, 'Dopravníky v priemyselnom podniku', 'priemysel', 'dopravníky, priemysel, realizácia', 'Priemyselný podnik s dopravníkmi, technikou ASTANA a pripraveným materiálom', true),
  asset(111, "Pracovisko pri veľkom objekte", "priemysel", "/likvidacia-azbestu/", "Priemyselný objekt a pracovná plocha počas realizácie ASTANA.", true),
  asset(1, "Interiér priemyselnej haly", "priemysel", "/realizacie/", "Pohľad do prázdnej priemyselnej haly s nosnou konštrukciou a pracovnou plochou.", false),
  asset(2, "Nosná konštrukcia priemyselnej haly", "priemysel", "/realizacie/", "Dlhý interiér priemyselnej haly s odkrytými nosnými prvkami.", false),
  asset(3, "Pohľad pod strechu priemyselného objektu", "priemysel", "/realizacie/", "Strešná a stenová konštrukcia priemyselnej haly pri pohľade z interiéru.", false),
  asset(4, "Pracovná plocha priemyselnej haly", "priemysel", "/realizacie/", "Vnútorná pracovná plocha a nosná konštrukcia veľkej priemyselnej haly.", false),
  asset(5, "Pracovník pri okraji strechy", "hospodarske-budovy", "/realizacie/", "Pracovník ASTANA v ochrannom obleku pri okraji strechy s prístupovým rebríkom.", false),
  asset(6, "Hospodársky objekt počas realizácie", "hospodarske-budovy", "/realizacie/", "Starší hospodársky objekt a materiál v pracovnom priestore počas realizácie ASTANA.", false),
  asset(7, "Odkrytá drevená konštrukcia strechy", "strechari", "/spolupracujuci-strechari/", "Pohľad z podkrovia na drevenú konštrukciu strechy po odstránení pôvodnej krytiny.", false),
  asset(8, 'Pracovisko pri rodinnom dome', 'rodinne-domy', 'galéria', 'Pracovisko pri rodinnom dome počas likvidácie eternitu', false),
  asset(9, 'Balenie azbestového odpadu', 'balenie-odvoz', 'galéria', 'Balenie azbestového odpadu do určených obalov', false),
  asset(10, 'Materiál pripravený na odvoz', 'balenie-odvoz', 'galéria', 'Zabalený azbestový materiál pripravený na odvoz', false),
  asset(11, "Strešná krytina pri komíne", "rodinne-domy", "/realizacie/", "Šikmá strešná plocha so staršou krytinou pri murovanom komíne.", false),
  asset(12, "Práce na streche pri rodinnom dome", "rodinne-domy", "/realizacie/", "Pracovník pri okraji strechy rodinného domu s rebríkom a ochranným vybavením.", false),
  asset(13, 'Kontrolované pracovisko', 'hospodarske-budovy', 'galéria', 'Kontrolované pracovisko pri hospodárskej budove s eternitom', false),
  asset(14, "Strešná konštrukcia počas demontáže", "strechari", "/realizacie/", "Odkrytá drevená konštrukcia strechy počas demontáže pôvodnej krytiny.", false),
  asset(15, 'Označené vrecia na odpad', 'balenie-odvoz', 'galéria', 'Označené vrecia určené na azbestový odpad', false),
  asset(16, 'Priemyselný priestor', 'priemysel', 'galéria', 'Priemyselný priestor pripravený na odborný postup pri azbeste', false),
  asset(17, "Menší objekt s odkrytou strechou", "hospodarske-budovy", "/realizacie/", "Menší hospodársky objekt s odkrytou strešnou konštrukciou počas prác ASTANA.", false),
  asset(18, "Ošetrenie strešnej krytiny", "rodinne-domy", "/likvidacia-eternitu/", "Ošetrovanie povrchu strešnej krytiny pracovníkom ASTANA v ochrannom obleku.", false),
  asset(19, "Rodinný dom s lešením", "rodinne-domy", "/realizacie/", "Rodinný dom s lešením a ohraničeným pracovným priestorom pri strešných prácach.", false),
  asset(20, 'Technická realizácia', 'priemysel', 'galéria', 'Technická realizácia likvidácie materiálov obsahujúcich azbest', false),
  asset(21, "Detail strešnej plochy pri komíne", "rodinne-domy", "/realizacie/", "Detail staršej strešnej krytiny a murovaného komína z fotodokumentácie ASTANA.", false),
  asset(22, "Stabilizácia strešnej krytiny", "rodinne-domy", "/realizacie/", "Ošetrovanie povrchu strešnej krytiny pred ďalšou manipuláciou.", false),
  asset(23, "Ošetrenie povrchu krytiny", "rodinne-domy", "/realizacie/", "Detail nanášania prípravku na povrch staršej strešnej krytiny počas prác ASTANA.", false),
  asset(24, "Hospodárska budova a pracovný priestor", "hospodarske-budovy", "/realizacie/", "Staršia hospodárska budova s odkrytou časťou strechy a pracovným priestorom pri objekte.", false),
  asset(25, 'Detail materiálu', 'rodinne-domy', 'galéria', 'Detail materiálu obsahujúceho azbest pred likvidáciou', false),
  asset(26, "Ošetrenie odkrytej strešnej konštrukcie", "strechari", "/realizacie/", "Ošetrovanie drevenej konštrukcie odkrytej počas demontáže strešnej krytiny.", false),
  asset(118, "Drevenica so staršou strechou", "rodinne-domy", "/poradna/", "Drevenica so staršou strešnou krytinou odfotografovaná od prístupovej cesty.", false),
  asset(119, "Drevenica vo fotodokumentácii ASTANA", "rodinne-domy", "/realizacie/", "Celkový pohľad na drevenicu so staršou strešnou krytinou počas realizácie ASTANA.", false),
  asset(120, "Vymedzené pracovisko pri priemyselnom objekte", "priemysel", "/poradna/ake-doklady-dostanete-po-likvidacii-azbestu/", "Vymedzený pracovný priestor pri priemyselnom objekte počas realizácie ASTANA.", false),
  asset(121, "Pracovná plocha pri priemyselnom objekte", "priemysel", "/postup/", "Pracovná plocha a materiál pri priemyselnom objekte z fotodokumentácie ASTANA.", true),
  asset(123, "Organizácia priemyselného pracoviska", "priemysel", "/realizacie/", "Výstražnou páskou ohraničená pracovná plocha pri priemyselnom objekte.", false),
  asset(124, "Pracovník na rozsiahlej streche", "rodinne-domy", "/realizacie/", "Pracovník ASTANA v ochrannom obleku na rozsiahlej strešnej ploche pri komíne.", false),
  asset(27, "Pracovník na odkrytej streche", "strechari", "/postup/", "Pracovník ASTANA na odkrytej drevenej konštrukcii strechy počas demontáže.", false),
  asset(28, "Strešné roviny počas demontáže", "rodinne-domy", "/poradna/", "Pohľad na strešnú plochu a odkrytú drevenú konštrukciu počas prác ASTANA.", false),
  asset(31, "Demontáž pri rodinnom dome", "rodinne-domy", "/likvidacia-azbestu-trnava/", "Rodinný dom s ohraničeným pracoviskom a pracovníkmi pri demontáži strechy.", false),
  asset(32, "Príprava povrchu strechy", "rodinne-domy", "/realizacie/", "Ošetrovanie strešnej krytiny na ploche pri komíne počas realizácie ASTANA.", false),
  asset(33, "Detail staršej strešnej krytiny", "rodinne-domy", "/poradna/", "Detail povrchu staršej strešnej krytiny z fotodokumentácie ASTANA.", false),
  asset(35, "Vstup do vymedzeného pracoviska", "priemysel", "/realizacie/", "Vstup do objektu ohraničený výstražnou páskou pri pracovnom vozidle ASTANA.", false),
  asset(36, "Celkový pohľad na rodinný dom", "rodinne-domy", "/poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/", "Rodinný dom, prístupová plocha a pracovné vozidlo počas realizácie ASTANA.", false),
  asset(39, "Rodinný dom s pripraveným pracoviskom", "rodinne-domy", "/likvidacia-azbestu-presov/", "Rodinný dom s lešením a výstražnou páskou pri príprave strešných prác.", false),
  asset(41, "Pracovník na streche hospodárskej budovy", "hospodarske-budovy", "/realizacie/", "Pracovník v ochrannom obleku na streche staršej hospodárskej budovy s prístupovým rebríkom.", false),
  asset(42, "Dlhý hospodársky objekt", "hospodarske-budovy", "/likvidacia-azbestu-banska-bystrica/", "Dlhý hospodársky objekt a prístupová plocha s pracovným vozidlom pri realizácii ASTANA.", false),
  asset(43, "Hospodársky objekt a jeho okolie", "hospodarske-budovy", "/realizacie/", "Dlhá hospodárska budova so strešnou krytinou a voľným priestorom pri objekte.", false),
  asset(46, "Staršia hospodárska strecha", "hospodarske-budovy", "/realizacie/", "Staršia hospodárska budova so strešnou krytinou a prístupom z dvora.", false),
  asset(48, "Prístup k rodinnému domu", "rodinne-domy", "/poradna/", "Celkový pohľad na rodinný dom a priestor pri vstupe počas realizácie ASTANA.", false),
  asset(49, "Pohľad na šikmú strechu", "rodinne-domy", "/likvidacia-azbestu-nitra/", "Šikmá strešná plocha so staršou krytinou a murovaným komínom.", false),
  asset(50, "Vozidlo ASTANA pri pracovisku", "rodinne-domy", "/kontakt/", "Vozidlo ASTANA pri ohraničenom pracovisku pri rodinnom dome.", false),
  asset(53, "Príprava práce pri rodinnom dome", "rodinne-domy", "/realizacie/", "Pracovník v ochrannom obleku pri rodinnom dome a pracovnom vybavení ASTANA.", false),
  asset(54, "Ochranné vybavenie pri práci", "rodinne-domy", "/poradna/", "Pracovník v ochrannom obleku pri strešných prácach ASTANA.", false),
  asset(56, "Pracovisko pri technologickej veži", "priemysel", "/realizacie/", "Technologická veža, ohraničený pracovný priestor a vozidlo ASTANA v priemyselnom areáli.", false),
  asset(60, "Pracovisko vo vnútri objektu", "interier", "/poradna/", "Interiér objektu s odkrytou konštrukciou a pracovným priestorom počas realizácie ASTANA.", false),
  asset(64, "Strešná plocha s komínmi", "rodinne-domy", "/realizacie/", "Pohľad na staršiu strešnú krytinu a viacero komínov z fotodokumentácie ASTANA.", false),
  asset(66, "Interiér s odkrytou konštrukciou", "interier", "/realizacie/", "Pohľad na odkrytú konštrukciu vo vnútri objektu počas realizácie ASTANA.", false),
  asset(67, "Vozidlo pri rozsiahlejšom objekte", "priemysel", "/o-firme/", "Pracovné vozidlo ASTANA pri vstupe do rozsiahlejšieho objektu počas realizácie.", false),
  asset(74, "Pracovné vozidlo pri vstupe do domu", "rodinne-domy", "/realizacie/", "Vozidlo ASTANA pri vstupe do rodinného domu s vymedzeným pracoviskom.", false),
  asset(75, "Pracovník pri príprave povrchu", "rodinne-domy", "/kariera/", "Pracovník ASTANA v ochrannom obleku pri ošetrovaní strešnej časti rodinného domu.", false),
  asset(79, "Rodinný dom počas strešných prác", "rodinne-domy", "/poradna/", "Rodinný dom s prístupovým rebríkom a ohraničeným pracoviskom pri strešných prácach.", false),
  asset(80, "Pracovný priestor pri priemyselnom objekte", "priemysel", "/poradna/", "Vonkajší pracovný priestor, obaly a konštrukcia pri priemyselnej realizácii ASTANA.", false),
  asset(81, "Obaly pri priemyselnej realizácii", "priemysel", "/poradna/", "Obaly na materiál pri priemyselnom objekte počas realizácie ASTANA.", false),
  asset(83, "Stabilizácia krytiny pri komíne", "rodinne-domy", "/realizacie/", "Ošetrovanie strešnej krytiny v blízkosti murovaného komína.", false),
  asset(84, "Pracovisko pri drevenici", "rodinne-domy", "/likvidacia-azbestu-poprad/", "Pracovné vozidlo ASTANA a ohraničený priestor pred drevenicou so staršou krytinou.", false),
  asset(88, "Pohľad zo strechy na jej tvar", "rodinne-domy", "/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/", "Pohľad zo strešnej roviny na tvar krytiny, hrebeň a komíny počas prác ASTANA.", false),
  asset(90, "Rodinný dom z fotodokumentácie ASTANA", "rodinne-domy", "/recenzie/", "Rodinný dom zachytený vo vlastnej fotodokumentácii realizácie ASTANA.", false),
  asset(94, "Vonkajšia konštrukcia priemyselného objektu", "priemysel", "/realizacie/", "Odkrytá vonkajšia konštrukcia veľkého priemyselného objektu počas realizácie ASTANA.", false),
  asset(108, "Priemyselný objekt s vozidlom ASTANA", "priemysel", "/likvidacia-azbestu-kosice/", "Priemyselný objekt a pracovné vozidlo ASTANA na prístupovej ploche.", false),
  asset(113, "Rodinný dom so staršou krytinou", "rodinne-domy", "/likvidacia-azbestu-zilina/", "Rodinný dom so staršou strešnou krytinou a vymedzeným pracovným priestorom.", false),
  asset(150, "Strešné práce na rodinnom dome", "rodinne-domy", "/cena-likvidacie-azbestu/", "Pracovníci ASTANA v ochrannom vybavení pri strešných prácach na rodinnom dome.", false),
  asset(155, "Pracovisko pri dome v zastavanom území", "rodinne-domy", "/likvidacia-azbestu-bratislava/", "Rodinný dom a ohraničený pracovný priestor pri strešných prácach ASTANA.", false),
  asset(163, "Strecha po odstránení krytiny", "strechari", "/strechari/", "Odkrytá drevená konštrukcia strechy po odstránení pôvodnej krytiny.", false),
  asset(172, "Pracovník v ochrannom vybavení v interiéri", "interier", "/realizacie/", "Pracovník ASTANA v ochrannom obleku pri ošetrovaní konštrukcie v interiéri.", false),
  asset(143, 'Zložený strešný materiál', 'balenie-odvoz', '/realizacie/', 'Zložené strešné dosky a úlomky pri pracovisku z fotodokumentácie ASTANA.', false),
] satisfies AzbestReference[];

export const getAzbestReference = (id: string) => {
  const reference = azbestReferences.find((item) => item.id === id);
  if (!reference) {
    throw new Error(`Missing azbest reference: ${id}`);
  }
  return reference;
};

export const heroPhoto = getAzbestReference(pagePhotoId('/'));

export const heroProofPhotos = [
  { ...getAzbestReference('azbest-051'), title: 'Stabilizácia' },
  { ...getAzbestReference('azbest-063'), title: 'Väčší rozsah' },
  { ...getAzbestReference('azbest-121'), title: 'Balenie a odvoz' },
];

export const realizationHighlights = [
  {
    image: getAzbestReference('azbest-164'),
    category: 'rodinny-dom',
    title: 'Kontrolované pracovisko',
    type: 'Rodinný dom',
    bullets: [
      'Materiál stabilizujeme ešte pred manipuláciou, aby sa znížilo riziko uvoľňovania prachu.',
      'Pracujeme v ochrannom vybavení a postup prispôsobujeme typu strechy.',
      'Zákazník vidí, že nejde o rýchle zhodenie krytiny, ale o riadený postup.',
    ],
  },
  {
    image: getAzbestReference('azbest-051'),
    category: 'rodinny-dom',
    title: 'Stabilizácia materiálu',
    type: 'Rodinný dom',
    bullets: [
      'Materiál pred manipuláciou stabilizujeme, aby sa znížilo riziko uvoľňovania prachu.',
      'Fotky a výmera pomáhajú spresniť prístup, výšku objektu a rozsah prác.',
      'Postup nastavujeme podľa konkrétnej strechy a požadovaných dokladov.',
    ],
  },
  {
    image: getAzbestReference('azbest-068'),
    category: 'rodinny-dom',
    title: 'Demontáž bez zhadzovania',
    type: 'Rodinný dom',
    bullets: [
      'Krytinu odoberáme kontrolovane bez zhadzovania zo strechy.',
      'Pracovisko držíme čitateľné pre zákazníka aj nadväzujúce profesie.',
      'Demontáž plánujeme tak, aby strechári mohli plynulo pokračovať.',
    ],
  },
  {
    image: getAzbestReference('azbest-120'),
    category: 'hospodarska-budova',
    title: 'Balenie a odvoz',
    type: 'Hospodárska budova',
    bullets: [
      'Riešime aj hospodárske objekty, dlhé strechy a väčšie plochy.',
      'Pri väčšom rozsahu je dôležitá logistika, balenie a plánovanie odvozu.',
      'Zákazník dostane jasný postup od nacenenia až po doklady.',
    ],
  },
  {
    image: getAzbestReference('azbest-110'),
    category: 'priemyselny-objekt',
    title: 'Technika ASTANA',
    type: 'Priemyselný objekt',
    bullets: [
      'Priemyselné zákazky vyžadujú koordináciu ľudí, techniky a dokumentácie.',
      'Odpad po zabalení odvážame na určené miesto podľa dohodnutého postupu.',
      'Priebeh nastavujeme podľa prístupu, rozsahu a typu materiálu.',
    ],
  },
  {
    image: getAzbestReference('azbest-106'),
    category: 'priemyselny-objekt',
    title: 'Väčší rozsah prác',
    type: 'Priemyselný objekt',
    bullets: [
      'Robíme aj technické prevádzky, dopravníky a väčšie priemyselné areály.',
      'Pri zložitejších objektoch je rozhodujúca príprava pracoviska a etapizácia.',
      'Dokumentácia sa rieši podľa konkrétnej zákazky a typu materiálu.',
    ],
  },
] satisfies Array<{
  image: AzbestReference;
  category: 'rodinny-dom' | 'hospodarska-budova' | 'garaz' | 'priemyselny-objekt';
  title: string;
  type: string;
  bullets: string[];
}>;

export const processPhotoReferences = [
  getAzbestReference('azbest-164'),
  getAzbestReference('azbest-130'),
  getAzbestReference('azbest-132'),
  getAzbestReference('azbest-051'),
  getAzbestReference('azbest-120'),
] as const;

export const whyProofPhotos = [
  getAzbestReference('azbest-062'),
  getAzbestReference('azbest-057'),
  getAzbestReference('azbest-106'),
];

export const practiceBlocks = [
  {
    image: getAzbestReference('azbest-051'),
    title: 'Stabilizácia materiálu',
    bullets: [
      'Materiál stabilizujeme ešte pred manipuláciou, aby sa znížilo riziko uvoľňovania prachu.',
      'Pracujeme v ochrannom vybavení a postup prispôsobujeme typu strechy a prístupu.',
      'Vďaka príprave je demontáž čistejšia, pokojnejšia a lepšie kontrolovaná.',
    ],
  },
  {
    image: getAzbestReference('azbest-134'),
    title: 'Kontrolovaná demontáž',
    bullets: [
      'Eternit nezhadzujeme zo strechy, materiál odoberáme kontrolovane.',
      'Pracovisko držíme organizované, aby sa po nás dalo nadviazať ďalšou prácou.',
      'Termín vieme podľa dohody zladiť so strechárom a stavom počasia.',
    ],
  },
  {
    image: getAzbestReference('azbest-121'),
    title: 'Balenie a odvoz',
    bullets: [
      'Odpad ukladáme do označených obalov a pripravíme ho na bezpečnú prepravu.',
      'Zákazník nemusí samostatne riešiť, kam materiál odviezť alebo kde ho skladovať.',
      'Po ukončení riešime balenie, odvoz a doklady podľa rozsahu zákazky.',
    ],
  },
];

export const rooferProofPhotos = [
  getAzbestReference('azbest-068'),
  getAzbestReference('azbest-135'),
  getAzbestReference('azbest-164'),
  getAzbestReference('azbest-024'),
];

export const galleryCategories = [
  { key: 'vsetko', label: 'Všetko' },
  { key: 'rodinne-domy', label: 'Rodinné domy' },
  { key: 'hospodarske-budovy', label: 'Hospodárske budovy' },
  { key: 'priemysel', label: 'Priemyselné objekty' },
  { key: 'interier', label: 'Interiér' },
  { key: 'balenie-odvoz', label: 'Balenie a odvoz' },
  { key: 'strechari', label: 'Strecha pripravená pre strechára' },
] as const;

// The first four assigned images belong to the hero strip, not the gallery.
export const galleryReferences = pagePhotoIds('/realizacie/').slice(4).map(getAzbestReference);

const homepageGalleryReferenceIds = [
  'azbest-134',
  'azbest-130',
  'azbest-006',
  'azbest-132',
  'azbest-011',
  'azbest-017',
  'azbest-014',
  'azbest-021',
  'azbest-118',
  'azbest-124',
  'azbest-018',
  'azbest-120',
] as const;

export const homepageGalleryReferences = homepageGalleryReferenceIds.map(getAzbestReference);

export const realizationHeroStripReferences = pagePhotoIds('/realizacie/').slice(0, 4).map(getAzbestReference);
