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
  openingHours: 'Po-Pia 7:00-18:00',
  areaServed: 'Slovensko',
  brandColor: '#DA251D',
  claimedStats: {
    foundedOrActiveSince: { value: '2011', confirmed: true },
    disposedArea: { value: '80 000+ m2', confirmed: true },
    customers: { value: '500+', confirmed: true },
  },
  sameAs: ['https://astana.sk'],
  documents: {
    public: [] as Array<{ name: string; url: string }>,
    publicVerificationUrl: 'https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf',
    note: 'Interné oprávnenia a PDF dokumenty sa z bezpečnostných a obchodných dôvodov nezverejňujú na stiahnutie. Verejná overiteľnosť je cez zoznam ÚVZ SR.',
  },
  compliance: {
    uvzAuthorizedCompaniesUrl: 'https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf',
    asbestosRemovalAuthorization: {
      exterior: true,
      interior: true,
      publicVerification: 'ASTANA, s.r.o. je verejne overiteľná v zozname ÚVZ SR medzi oprávnenými spoločnosťami na odstraňovanie azbestu a materiálov obsahujúcich azbest zo stavieb.',
      internalDocumentsPublic: false,
    },
    googleBusinessProfile: {
      status: 'založený',
      urlTodo: 'TODO: doplniť verejnú URL Google Business Profile po potvrdení majiteľom.',
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

export const serviceOffer = [
  'cenová ponuka podľa výmery, lokality a typu materiálu',
  'potrebné podklady a dokumentácia podľa konkrétnej zákazky',
  'stabilizácia materiálu pred manipuláciou',
  'bezpečná demontáž bez zbytočného lámania a zhadzovania',
  'balenie azbestového odpadu do určených obalov',
  'odvoz odpadu na určené miesto',
  'potvrdenie alebo dokumentácia po legálnej likvidácii',
] as const;

export const ownerTodos = [
  'Potvrdiť verejné používanie štatistík 2011, 80 000+ m2 a 500+ zákazníkov.',
  'Doplniť verejnú URL Google Business Profile, keď bude potvrdená.',
  'Doplniť reálne schválené recenzie so súhlasom zákazníkov.',
  'Doplniť popisy realizácií: okres, typ objektu, materiál a výmera iba tam, kde sú údaje potvrdené.',
  'Doplniť reálne firemné profily do sameAs iba vtedy, keď sú verejné a potvrdené.',
] as const;
