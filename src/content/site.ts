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
  openingHours: 'Po–Pia 7:00–18:00',
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
  sameAs: ['https://astana.sk'],
  documents: {
    public: [] as Array<{ name: string; url: string }>,
    publicVerificationUrl: 'https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf',
    note: 'Verejný odkaz vedie na zoznam ÚVZ SR zverejnený k 19. 9. 2024; sám nepotvrdzuje zmeny po tomto dátume.',
  },
  compliance: {
    uvzAuthorizedCompaniesUrl: 'https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf',
    asbestosRemovalAuthorization: {
      publicVerificationAsOf: '2024-09-19',
      scopeAsPublished: ['EXT, BJ', 'INT'],
      publicVerification: 'Zoznam ÚVZ SR zverejnený k 19. 9. 2024 uvádza ASTANA, s.r.o. s oprávneniami označenými EXT, BJ a INT. Ide o stav zachytený v tomto zozname; aktuálnosť po uvedenom dátume z neho nemožno potvrdiť.',
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
