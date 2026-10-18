export const site = {
  brandName: 'ASTANA',
  legalName: 'ASTANA, s.r.o.',
  website: 'https://likvidacia-eternitu.sk',
  phone: '0905 217 946',
  phoneHref: '+421905217946',
  email: 'astana@astana.sk',
  address: {
    street: 'Scherffelova 1364/28',
    postalCode: '058 01',
    locality: 'Poprad',
    country: 'SK',
  },
  ico: '46 157 701',
  dic: '2023253771',
  icDph: 'SK2023253771',
  openingHours: 'Po–Pia 8:00–18:00',
  areaServed: 'Slovensko',
  brandColor: '#DA251D',
  claimedStats: {
    foundedOrActiveSince: {
      value: '2011',
      confirmed: true,
      sourceUrl: 'https://www.registeruz.sk/cruz-public/domain/accountingentity/show/1124019',
      verifiedAsOf: '2026-10-07',
    },
  },
  sameAs: ['https://www.astana.sk/', 'https://likvidovanie-azbestu.sk/'],
  centralCompanyServices: {
    roofingAndCarpentry: {
      statement: 'Centrálna firemná stránka ASTANA uvádza strechy a krovy medzi službami ASTANA, s.r.o. Presný rozsah konkrétnej zákazky určuje cenová ponuka a dohoda so zákazníkom.',
      sourceUrl: 'https://www.astana.sk/Strechy-krovy',
    },
  },
  documents: {
    public: [] as Array<{ name: string; url: string }>,
    publicVerificationUrl: 'https://www.uvzsr.sk/web/uvz/zoznam-fyzickych-osob-podnikatelov-a-pravnickych-osob-ktorym-bolo-vydane-odobrate-alebo-zmenene-opravnenie-na-odstranovanie-azbestu-alebo-materialov-obsahujucich-azbest-zo-stavieb',
    verificationSourceUrl: 'https://www.astana.sk/overene-informacie',
    historicalSnapshotUrl: 'https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf',
    note: 'Aktuálny verejný register ÚVZ SR vyhľadávajte podľa IČO 46 157 701. Centrálny firemný zdroj ASTANA uvádza overenie záznamov v registri 14. 10. 2026; zoznam z 19. 9. 2024 je len historický snapshot.',
  },
  compliance: {
    uvzAuthorizedCompaniesUrl: 'https://www.uvzsr.sk/web/uvz/zoznam-fyzickych-osob-podnikatelov-a-pravnickych-osob-ktorym-bolo-vydane-odobrate-alebo-zmenene-opravnenie-na-odstranovanie-azbestu-alebo-materialov-obsahujucich-azbest-zo-stavieb',
    asbestosRemovalAuthorization: {
      publicVerificationAsOf: '2026-10-14',
      scopeAsPublished: ['BJ, EXT', 'INT'],
      publicVerification: 'Centrálny firemný zdroj ASTANA uvádza overenie v aktuálnom verejnom registri ÚVZ SR k 14. 10. 2026: pri IČO 46 157 701 sú záznamy OPPL/3064/2013-Fe (BJ, EXT) a OPPL/7683/2013-Fe (INT). V registri vyhľadajte IČO; samostatný trvalý odkaz na jeden riadok nie je k dispozícii.',
      verificationSourceUrl: 'https://www.astana.sk/overene-informacie',
      historicalSnapshot: {
        asOf: '2024-09-19',
        url: 'https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf',
        note: 'Starší zoznam ÚVZ SR je zachovaný len ako historický snapshot a nenahrádza aktuálny register.',
      },
      internalDocumentsPublic: false,
    },
    reviews: {
      collectedSystematically: false,
      publicVerifiedReviews: false,
      schemaPolicy: 'Web nepoužíva Review ani AggregateRating schema, kým nie sú verejné overené recenzie.',
    },
    gallery: {
      realAstanaWorkPhotos: true,
      locationAndAreaPolicy: 'Lokality a výmery pri fotkách sa neuvádzajú, ak nie sú spoľahlivo potvrdené.',
    },
  },
} as const;

export const astanaWebsites = [
  {
    url: 'https://www.astana.sk/',
    name: 'ASTANA.sk',
    role: 'Firemný web ASTANA, s.r.o. a širší prehľad služieb spoločnosti vrátane potvrdených služieb strechy a krovy.',
  },
  {
    url: site.website,
    name: 'Likvidacia-eternitu.sk',
    role: 'Špecializovaný web pre eternitové a azbestové strechy, cenovú ponuku, demontáž a koordináciu so strechármi.',
  },
  {
    url: 'https://likvidovanie-azbestu.sk/',
    name: 'Likvidovanie-azbestu.sk',
    role: 'Doplnkový odborný web pre azbest na nehnuteľnosti, v interiéri a pri špecializovaných vonkajších situáciách.',
  },
] as const;

export const companyAddressLine = `${site.address.street}, ${site.address.postalCode} ${site.address.locality}`;
export const phoneLink = `tel:${site.phoneHref}`;
export const emailLink = `mailto:${site.email}`;

export const serviceDocumentationOutcome =
  'potvrdenie alebo dokumentácia po legálnej likvidácii podľa rozsahu zákazky';

export const serviceOffer = [
  'cenová ponuka podľa výmery, lokality a typu materiálu',
  'potrebné podklady a dokumentácia podľa konkrétnej zákazky',
  'stabilizácia materiálu pred manipuláciou',
  'bezpečná demontáž bez zbytočného lámania a zhadzovania',
  'balenie azbestového odpadu do určených obalov',
  'odvoz odpadu na určené miesto',
  serviceDocumentationOutcome,
] as const;

export const ownerTodos = [
  'Nezverejňovať štatistiky m2 ani počtu zákazníkov, kým nie sú doložené z prevádzkových podkladov.',
  'Doplniť verejnú URL Google Business Profile, keď bude potvrdená.',
  'Doplniť reálne schválené recenzie so súhlasom zákazníkov.',
  'Doplniť popisy realizácií: okres, typ objektu, materiál a výmera iba tam, kde sú údaje potvrdené.',
  'Doplniť reálne firemné profily do sameAs iba vtedy, keď sú verejné a potvrdené.',
] as const;
