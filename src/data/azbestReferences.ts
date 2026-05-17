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
  asset(1, 'Rodinný dom s eternitovou krytinou', 'rodinne-domy', 'galéria', 'Rodinný dom s eternitovou strechou pred odborným postupom', false),
  asset(2, 'Detail strešnej krytiny', 'rodinne-domy', 'galéria', 'Detail azbestocementovej krytiny na streche rodinného domu', false),
  asset(3, 'Príprava pracoviska', 'rodinne-domy', 'galéria', 'Príprava pracoviska pred kontrolovanou demontážou eternitu', false),
  asset(4, 'Eternit na hospodárskej budove', 'hospodarske-budovy', 'galéria', 'Hospodárska budova s eternitovou krytinou pred likvidáciou', false),
  asset(5, 'Kontrolovaná manipulácia', 'rodinne-domy', 'galéria', 'Kontrolovaná manipulácia s azbestocementovým materiálom na streche', false),
  asset(6, 'Strešná krytina pred stabilizáciou', 'rodinne-domy', 'galéria', 'Azbestocementová strešná krytina pred stabilizáciou materiálu', false),
  asset(7, 'Pracovník na streche', 'rodinne-domy', 'galéria', 'Pracovník v ochrannom obleku na streche s eternitovou krytinou', false),
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
  { ...getAzbestReference('azbest-051'), title: 'Stabilizácia materiálu' },
  { ...getAzbestReference('azbest-164'), title: 'Kontrolovaná demontáž' },
  { ...getAzbestReference('azbest-065'), title: 'Balenie a odvoz' },
];

export const realizationHighlights = [
  {
    image: getAzbestReference('azbest-087'),
    title: 'Rodinný dom - stabilizácia eternitu',
    type: 'Rodinný dom',
    bullets: ['stabilizácia materiálu', 'ochranné vybavenie', 'odvoz a doklady podľa zákazky'],
  },
  {
    image: getAzbestReference('azbest-068'),
    title: 'Rodinný dom - kontrolovaná demontáž',
    type: 'Rodinný dom',
    bullets: ['kontrolovaná manipulácia', 'bez zhadzovania zo strechy', 'príprava pre ďalšie práce'],
  },
  {
    image: getAzbestReference('azbest-135'),
    title: 'Drevenica - kontrolovaná práca vo výške',
    type: 'Rodinný dom / drevenica',
    bullets: ['kontrolovaný prístup', 'ochranné vybavenie', 'nadväznosť prác'],
  },
  {
    image: getAzbestReference('azbest-110'),
    title: 'Priemyselný objekt',
    type: 'Priemyselný objekt',
    bullets: ['väčší rozsah prác', 'technické prostredie', 'koordinácia odvozu'],
  },
  {
    image: getAzbestReference('azbest-091'),
    title: 'Balenie a odvoz odpadu',
    type: 'Balenie a odvoz',
    bullets: ['označené obaly', 'príprava na prepravu', 'odovzdanie podľa zákazky'],
  },
  {
    image: getAzbestReference('azbest-171'),
    title: 'Interiér / technický priestor',
    type: 'Interiérový priestor',
    bullets: ['ochranné vybavenie', 'kontrolovaný postup', 'dokumentácia podľa rozsahu'],
  },
];

export const processPhotoReferences = [
  getAzbestReference('azbest-132'),
  getAzbestReference('azbest-130'),
  null,
  getAzbestReference('azbest-018'),
  getAzbestReference('azbest-019'),
] as const;

export const whyProofPhotos = [
  getAzbestReference('azbest-018'),
  getAzbestReference('azbest-160'),
  getAzbestReference('azbest-020'),
];

export const practiceBlocks = [
  {
    image: getAzbestReference('azbest-051'),
    title: 'Stabilizácia materiálu',
    bullets: ['materiál sa pripraví pred manipuláciou', 'pracovníci používajú ochranné vybavenie', 'postup sa prispôsobuje typu strechy'],
  },
  {
    image: getAzbestReference('azbest-134'),
    title: 'Kontrolovaná demontáž',
    bullets: ['eternit sa nezhadzuje zo strechy', 'pracovisko je organizované', 'termín sa dá zladiť so strechárom'],
  },
  {
    image: getAzbestReference('azbest-091'),
    title: 'Balenie a odvoz',
    bullets: ['odpad ide do označených obalov', 'materiál je pripravený na prepravu', 'doklady sa riešia podľa zákazky'],
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
] as const;

const galleryReferenceIds = [
  'azbest-134',
  'azbest-130',
  'azbest-132',
  'azbest-006',
  'azbest-007',
  'azbest-011',
  'azbest-012',
  'azbest-014',
  'azbest-017',
  'azbest-021',
  'azbest-022',
  'azbest-026',
  'azbest-001',
  'azbest-002',
  'azbest-003',
  'azbest-004',
  'azbest-005',
  'azbest-008',
  'azbest-015',
  'azbest-016',
  'azbest-023',
  'azbest-025',
  'azbest-171',
  'azbest-160',
] as const;

export const galleryReferences = galleryReferenceIds.map(getAzbestReference);
