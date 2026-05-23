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
  asset(87, 'Stabilizácia eternitovej strechy', 'rodinne-domy', 'hero, realizácia, proces', 'Pracovník ASTANA stabilizuje eternitovú strechu pred demontážou', true),
  asset(164, 'Rodinný dom s kontrolovaným pracoviskom', 'rodinne-domy', 'hero dôkaz, strechári, proces', 'Likvidácia eternitu na rodinnom dome s výstražným páskovaním pracoviska', true),
  asset(51, 'Detail stabilizácie materiálu', 'rodinne-domy', 'detail, prax, stabilizácia', 'Pracovník v ochrannom obleku stabilizuje azbestový materiál na streche', true),
  asset(68, 'Kontrolovaná demontáž na streche', 'rodinne-domy', 'realizácia, strechári, galéria', 'Kontrolovaná demontáž eternitovej strechy na rodinnom dome', true),
  asset(135, 'Demontáž azbestocementovej krytiny', 'rodinne-domy', 'realizácia, galéria', 'Pracovníci v ochranných oblekoch pri demontáži azbestocementovej krytiny', false),
  asset(69, 'Práca na lešení', 'rodinne-domy', 'strechári, lešenie, galéria', 'Pracovník ASTANA manipuluje s materiálom na lešení pri kontrolovanom pracovisku', false),
  asset(134, 'Strecha s lešením', 'rodinne-domy', 'realizácia, galéria', 'Strecha pripravená na odbornú likvidáciu eternitu s použitím lešenia', false),
  asset(110, 'Priemyselný objekt a odvoz', 'priemysel', 'priemysel, odvoz, galéria', 'Priemyselný objekt s vozidlom ASTANA pripravený na práce s azbestom', true),
  asset(91, 'Balenie odpadu pred odvozom', 'balenie-odvoz', 'balenie, odvoz, prax', 'Azbestový odpad zabalený v označených vreciach pred odvozom', true),
  asset(171, 'Technický priestor s azbestom', 'interier', 'interiér, galéria', 'Pracovníci v ochranných oblekoch pri sanácii azbestu v technickom priestore', false),
  asset(160, 'Interiérový priestor', 'interier', 'interiér, realizácia', 'Sanácia azbestu v interiérovom technickom priestore', false),
  asset(130, 'Detail eternitovej krytiny', 'rodinne-domy', 'proces, detail, galéria', 'Detail eternitovej krytiny pred odbornou demontážou', false),
  asset(132, 'Detail strechy pred demontážou', 'rodinne-domy', 'proces, detail', 'Detail azbestocementovej strešnej krytiny pred stabilizáciou', false),
  asset(65, 'Pracovisko pripravené na odvoz', 'balenie-odvoz', 'proces, odvoz', 'Pracovisko pripravené na odvoz azbestového odpadu podľa zákazky', false),
  asset(57, 'Dlhý hospodársky objekt', 'hospodarske-budovy', 'kravín, hospodárska budova, galéria', 'Dlhý hospodársky objekt s materiálmi obsahujúcimi azbest pred odborným postupom', false),
  asset(62, 'Priemyselné veže a technologické silá', 'priemysel', 'priemysel, veže, galéria', 'Priemyselné technologické veže a silá pri objekte s materiálmi obsahujúcimi azbest', false),
  asset(63, 'Hospodársky areál s dlhým objektom', 'hospodarske-budovy', 'kravín, hospodársky areál, galéria', 'Dlhý hospodársky objekt v areáli pripravenom na odborný postup pri azbeste', false),
  asset(106, 'Dopravníky v priemyselnom podniku', 'priemysel', 'dopravníky, priemysel, realizácia', 'Priemyselný podnik s dopravníkmi, technikou ASTANA a pripraveným materiálom', true),
  asset(111, 'Priemyselný areál s vozidlami ASTANA', 'priemysel', 'vozidlá, priemysel, galéria', 'Priemyselný areál s vozidlami ASTANA a pripraveným kontrolovaným pracoviskom', true),
  asset(1, 'Rodinný dom s eternitovou krytinou', 'rodinne-domy', 'galéria', 'Rodinný dom s eternitovou strechou pred odborným postupom', false),
  asset(2, 'Detail strešnej krytiny', 'rodinne-domy', 'galéria', 'Detail azbestocementovej krytiny na streche rodinného domu', false),
  asset(3, 'Príprava pracoviska', 'rodinne-domy', 'galéria', 'Príprava pracoviska pred kontrolovanou demontážou eternitu', false),
  asset(4, 'Eternit na hospodárskej budove', 'hospodarske-budovy', 'galéria', 'Hospodárska budova s eternitovou krytinou pred likvidáciou', false),
  asset(5, 'Kontrolovaná manipulácia', 'rodinne-domy', 'galéria', 'Kontrolovaná manipulácia s azbestocementovým materiálom na streche', false),
  asset(6, 'Strešná krytina pred stabilizáciou', 'rodinne-domy', 'galéria', 'Azbestocementová strešná krytina pred stabilizáciou materiálu', false),
  asset(7, 'Strešná konštrukcia po demontáži', 'rodinne-domy', 'galéria', 'Strešná konštrukcia po odstránení azbestocementovej krytiny', false),
  asset(8, 'Pracovisko pri rodinnom dome', 'rodinne-domy', 'galéria', 'Pracovisko pri rodinnom dome počas likvidácie eternitu', false),
  asset(9, 'Balenie azbestového odpadu', 'balenie-odvoz', 'galéria', 'Balenie azbestového odpadu do určených obalov', false),
  asset(10, 'Materiál pripravený na odvoz', 'balenie-odvoz', 'galéria', 'Zabalený azbestový materiál pripravený na odvoz', false),
  asset(11, 'Strecha pred demontážou', 'rodinne-domy', 'galéria', 'Eternitová strecha pred kontrolovanou demontážou', false),
  asset(12, 'Práca na strešnej krytine', 'rodinne-domy', 'galéria', 'Odborná práca na azbestocementovej strešnej krytine', false),
  asset(13, 'Kontrolované pracovisko', 'hospodarske-budovy', 'galéria', 'Kontrolované pracovisko pri hospodárskej budove s eternitom', false),
  asset(14, 'Stabilizácia a demontáž', 'rodinne-domy', 'galéria', 'Stabilizácia a postupná demontáž materiálu obsahujúceho azbest', false),
  asset(15, 'Označené vrecia na odpad', 'balenie-odvoz', 'galéria', 'Označené vrecia určené na azbestový odpad', false),
  asset(16, 'Priemyselný priestor', 'priemysel', 'galéria', 'Priemyselný priestor pripravený na odborný postup pri azbeste', false),
  asset(17, 'Práca pri väčšej streche', 'rodinne-domy', 'galéria', 'Pracovníci pri väčšej eternitovej streche počas realizácie', false),
  asset(18, 'Strecha pripravená pre ďalšie práce', 'strechari', 'galéria, strechári', 'Strecha po odstránení materiálu pripravená pre ďalšie práce', false),
  asset(19, 'Odvoz materiálu', 'balenie-odvoz', 'galéria', 'Príprava zabaleného materiálu na odvoz na určené miesto', false),
  asset(20, 'Technická realizácia', 'priemysel', 'galéria', 'Technická realizácia likvidácie materiálov obsahujúcich azbest', false),
  asset(21, 'Rodinný dom v realizácii', 'rodinne-domy', 'galéria', 'Rodinný dom počas odbornej likvidácie eternitovej krytiny', false),
  asset(22, 'Kontrolovaná demontáž s ochrannými pomôckami', 'rodinne-domy', 'galéria', 'Kontrolovaná demontáž s použitím ochranných pomôcok', false),
  asset(23, 'Balenie po demontáži', 'balenie-odvoz', 'galéria', 'Balenie materiálu po demontáži do označených obalov', false),
  asset(24, 'Pracovisko s eternitom', 'hospodarske-budovy', 'galéria', 'Pracovisko s eternitovým materiálom pred odborným odvozom', false),
  asset(25, 'Detail materiálu', 'rodinne-domy', 'galéria', 'Detail materiálu obsahujúceho azbest pred likvidáciou', false),
  asset(26, 'Stabilizácia strešnej konštrukcie', 'rodinne-domy', 'galéria', 'Stabilizácia strešnej konštrukcie pred pokračovaním prác', false),
  asset(118, 'Drevenica s eternitovou strechou', 'rodinne-domy', 'galéria', 'Drevenica s eternitovou strechou pripravená na odborný postup', false),
  asset(119, 'Kontrolované pracovisko pri drevenici', 'rodinne-domy', 'galéria', 'Kontrolované pracovisko pri drevenici s materiálom obsahujúcim azbest', false),
  asset(120, 'Zabalený materiál v kontrolovanom priestore', 'balenie-odvoz', 'balenie, odvoz, galéria', 'Zabalený azbestový materiál vo vyznačenom kontrolovanom priestore', false),
  asset(121, 'Balenie odpadu v kontrolovanom priestore', 'balenie-odvoz', 'balenie, odvoz, prax', 'Azbestový odpad pripravený v kontrolovanom priestore bez verejných údajov', true),
  asset(123, 'Kontrolované pracovisko pri priemyselnom objekte', 'priemysel', 'priemysel, dokumentácia, galéria', 'Kontrolované pracovisko pri priemyselnom objekte s vyznačeným priestorom', false),
  asset(124, 'Pracovník na streche pri stabilizácii', 'rodinne-domy', 'galéria, proces', 'Pracovník v ochrannom obleku stabilizuje eternitovú strechu', false),
] satisfies AzbestReference[];

export const getAzbestReference = (id: string) => {
  const reference = azbestReferences.find((item) => item.id === id);
  if (!reference) {
    throw new Error(`Missing azbest reference: ${id}`);
  }
  return reference;
};

export const heroPhoto = getAzbestReference('azbest-087');

export const heroProofPhotos = [
  { ...getAzbestReference('azbest-051'), title: 'Stabilizácia' },
  { ...getAzbestReference('azbest-063'), title: 'Väčší rozsah' },
  { ...getAzbestReference('azbest-121'), title: 'Balenie a odvoz' },
];

export const realizationHighlights = [
  {
    image: getAzbestReference('azbest-164'),
    category: 'rodinny-dom',
    title: 'Rodinný dom s kontrolovaným pracoviskom',
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
    title: 'Detail stabilizácie materiálu',
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
    title: 'Kontrolovaná demontáž na streche',
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
    title: 'Hospodárska budova po odvoze',
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
    title: 'Priemyselný objekt a odvoz',
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
    title: 'Dopravníky v priemyselnom podniku',
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

const galleryReferenceIds = [
  'azbest-134',
  'azbest-130',
  'azbest-006',
  'azbest-132',
  'azbest-011',
  'azbest-017',
  'azbest-014',
  'azbest-021',
  'azbest-022',
  'azbest-026',
  'azbest-118',
  'azbest-124',
  'azbest-106',
  'azbest-063',
  'azbest-119',
  'azbest-007',
  'azbest-012',
  'azbest-111',
  'azbest-001',
  'azbest-002',
  'azbest-057',
  'azbest-003',
  'azbest-004',
  'azbest-005',
  'azbest-023',
  'azbest-025',
  'azbest-120',
  'azbest-123',
  'azbest-171',
  'azbest-160',
] as const;

export const galleryReferences = galleryReferenceIds.map(getAzbestReference);

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

export const realizationHeroStripReferences = [
  getAzbestReference('azbest-087'),
  getAzbestReference('azbest-057'),
  getAzbestReference('azbest-106'),
  getAzbestReference('azbest-121'),
];
