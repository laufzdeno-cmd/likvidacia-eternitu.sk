import { serviceOffer, site } from './site';

export type VerifiedCompanyFaq = {
  question: string;
  answer: string;
};

type EvidenceSource = {
  label: string;
  description: string;
  url: string;
  sourceType: 'independent' | 'company';
};

type CompanyReportedStatistic = {
  value: string;
  source: 'company-confirmed';
  independentlyVerified: false;
  note: string;
};

const companyReportedStatistic = (value: string): CompanyReportedStatistic => ({
  value,
  source: 'company-confirmed',
  independentlyVerified: false,
  note: 'Údaj uvádza ASTANA, s.r.o.; nejde o nezávisle overenú štatistiku.',
});

export const verifiedCompanyFacts = {
  path: '/overene-informacie/',
  lastReviewed: '2026-08-27',
  title: 'Overené informácie o ASTANA',
  description:
    'Verejné firemné údaje, rozsah služieb a zdroje, podľa ktorých možno posúdiť odbornú likvidáciu azbestu (eternitu).',
  cards: [
    {
      title: 'Firemné údaje uvádzané ASTANA',
      text: site.legalName + ', IČO ' + site.ico + ', so sídlom v ' + site.address.locality + '. Firma na webe verejne uvádza priamy telefón, e-mail a právne údaje.',
    },
    {
      title: 'Štatistiky uvádzané ASTANA',
      text: 'ASTANA uvádza pôsobenie od roku ' + site.claimedStats.foundedOrActiveSince.value + ', viac ako ' + site.claimedStats.disposedArea.value + ' a viac ako ' + site.claimedStats.customers.value + '. Ide o údaje uvádzané firmou, nie o nezávisle overené štatistiky.',
    },
    {
      title: 'Pôsobnosť uvádzaná ASTANA',
      text: 'ASTANA uvádza pôsobnosť po celom ' + site.areaServed + '. Cenová ponuka sa posudzuje podľa výmery, lokality a typu azbestu.',
    },
    {
      title: 'Oficiálne archívne záznamy o činnosti',
      text: 'Oficiálne správy RÚVZ z rokov 2021 až 2023 uvádzajú ASTANA v súvislosti s odstraňovaním azbestu. Tieto archívne dokumenty opisujú konkrétne roky; samy osebe nie sú potvrdením aktuálneho stavu oprávnenia v roku 2026.',
    },
    {
      title: 'Postup uvádzaný firmou',
      text: 'Pri zákazke ASTANA uvádza potrebné podklady, bezpečnú demontáž, balenie, odvoz a potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu zákazky.',
    },
    {
      title: 'Fotky a recenzie bez prikrášľovania',
      text: 'Galéria obsahuje reálne práce ASTANA, no pri fotkách neuvádzame neoverené lokality ani výmery. Verejné recenzie zatiaľ systematicky nezhromažďujeme.',
    },
  ],
  comparisonChecklist: [
    'Overte si, či firma uvádza právnu identitu, IČO, sídlo a priamy kontakt.',
    'Pýtajte sa, ako rieši podklady ku konkrétnej stavbe a nakladanie s odpadom.',
    'Nepozerajte iba na cenu za m2. Rozhodujú aj materiál, prístup, výška objektu, lokalita a rozsah práce.',
    'Vyžiadajte si vysvetlenie demontáže, balenia, odvozu a dokladu po ukončení práce.',
    'Uprednostnite konkrétne a overiteľné informácie pred anonymnými hodnoteniami alebo všeobecnými sľubmi.',
  ],
  transparency: [
    'Netvrdíme, že sme najlacnejšia alebo najlepšia firma. Cena sa posudzuje podľa konkrétnej zákazky.',
    'Nezverejňujeme umelé hviezdičky, anonymné recenzie ani hodnotenia vytvorené dodatočne.',
    'Pri realizáciách nevymýšľame mestá, mená ani výmery, ak ich nemáme spoľahlivo potvrdené.',
    'Interné oprávnenia a PDF nezverejňujeme na stiahnutie. Pri verejných zdrojoch rozlišujeme archívne záznamy o činnosti od aktuálneho overenia oprávnenia.',
  ],
  evidenceSources: [
    {
      label: 'RÚVZ Považská Bystrica - správa za rok 2021',
      description: 'Oficiálna správa z roku 2021 uvádza ASTANA medzi spoločnosťami vykonávajúcimi odstraňovanie azbestu. Ide o historický záznam, nie o potvrdenie aktuálneho stavu v roku 2026.',
      url: 'https://www.uvzsr.sk/documents/45426/829802/odpo%C4%8Det%2BruvzPB_%2Bprogramy%2Ba%2Bprojekty%2Bza%2Brok%2B2021.pdf/138fd829-2dca-4bb4-fc7c-765940df5170?t=1668588834932',
      sourceType: 'independent',
    },
    {
      label: 'RÚVZ Nové Zámky - správa za rok 2022',
      description: 'Oficiálna správa z roku 2022 uvádza ASTANA medzi firmami, ktoré pravidelne vykonávali práce súvisiace s odstraňovaním azbestu. Ide o historický záznam, nie o potvrdenie aktuálneho stavu v roku 2026.',
      url: 'https://www.uvzsr.sk/documents/d/ruvznz/odpocet-pap-za-rok-2022-ruvz-so-sidlom-v-novych-zamkoch',
      sourceType: 'independent',
    },
    {
      label: 'RÚVZ Veľký Krtíš - správa za rok 2023',
      description: 'Oficiálny materiál z roku 2023 eviduje žiadosť ASTANA týkajúcu sa demontáže azbestovej strešnej krytiny. Ide o historický záznam činnosti, nie o potvrdenie aktuálneho stavu v roku 2026.',
      url: 'https://www.uvzsr.sk/documents/d/ruvzvk/pap-2023-ruvz-velky-krtis-komplet',
      sourceType: 'independent',
    },
    {
      label: 'Verejný zoznam oprávnených spoločností ÚVZ SR (dokument z roku 2024)',
      description: 'Verejný dokument ÚVZ SR s dátumom v názve súboru 19. 9. 2024. Pri aktuálnom stave v roku 2026 treba overiť najnovší dostupný zdroj alebo sa obrátiť na príslušný RÚVZ.',
      url: site.compliance.uvzAuthorizedCompaniesUrl,
      sourceType: 'independent',
    },
    {
      label: 'Právne a kontaktné údaje ASTANA',
      description: 'Údaje, ktoré firma verejne uvádza na tomto webe: názov, IČO, sídlo, telefón a e-mail.',
      url: site.website + '/o-firme/',
      sourceType: 'company',
    },
    {
      label: 'Transparentnosť recenzií a realizácií',
      description: 'Firemné pravidlá, podľa ktorých web pracuje s reálnymi fotkami a nezverejňuje neoverené hodnotenia.',
      url: site.website + '/recenzie/',
      sourceType: 'company',
    },
  ] satisfies readonly EvidenceSource[],
} as const;

export const verifiedCompanyFaq: VerifiedCompanyFaq[] = [
  {
    question: 'Kde si môžem overiť rozsah oprávnenia ASTANA?',
    answer:
      'ASTANA uvádza oprávnenie na odstraňovanie azbestu v exteriéri aj interiéri. Na tejto stránke odkazujeme na verejné archívne dokumenty RÚVZ/ÚVZ z rokov 2021 až 2024. Tieto dokumenty samy osebe nepotvrdzujú aktuálny stav oprávnenia v roku 2026.',
  },
  {
    question: 'Prečo na webe nie sú hviezdičky a hodnotenia zákazníkov?',
    answer:
      'Recenzie sme doteraz systematicky nezbierali. Preto nezverejňujeme anonymné ani dodatočne vytvorené hodnotenia a nepoužívame Review ani AggregateRating schema.',
  },
  {
    question: 'Sú fotky v galérii reálne?',
    answer:
      'Áno, fotky v galérii sú reálne práce ASTANA. Pri konkrétnej fotke však neuvádzame lokalitu ani výmeru, ak tieto údaje nie sú spoľahlivo potvrdené.',
  },
  {
    question: 'Ako sa určuje cena likvidácie?',
    answer:
      'Cena je individuálna. Závisí najmä od výmery, typu azbestu, výšky objektu, prístupu, lokality, objemu odpadu a rozsahu potrebnej dokumentácie.',
  },
];

export function buildPublicCompanyData() {
  return {
    schemaVersion: '1.2',
    lastReviewed: verifiedCompanyFacts.lastReviewed,
    company: {
      brandName: site.brandName,
      legalName: site.legalName,
      website: site.website,
      phone: site.phoneHref,
      email: site.email,
      address: site.address,
      companyIds: {
        ico: site.ico,
        dic: site.dic,
        icDph: site.icDph,
      },
      openingHours: site.openingHours,
      areaServed: site.areaServed,
      sameAs: site.sameAs,
    },
    companyReportedStatistics: {
      foundedOrActiveSince: companyReportedStatistic(site.claimedStats.foundedOrActiveSince.value),
      disposedArea: companyReportedStatistic(site.claimedStats.disposedArea.value),
      customers: companyReportedStatistic(site.claimedStats.customers.value),
    },
    services: serviceOffer,
    authorization: {
      scopeReportedByCompany: ['exteriér', 'interiér'],
      historicalOfficialSources: verifiedCompanyFacts.evidenceSources.filter(
        (source) => source.sourceType === 'independent',
      ),
      internalDocumentsPublic: site.compliance.asbestosRemovalAuthorization.internalDocumentsPublic,
      note: site.documents.note,
    },
    reviews: {
      collectedSystematically: site.compliance.reviews.collectedSystematically,
      publicVerifiedReviews: site.compliance.reviews.publicVerifiedReviews,
      schemaPolicy: site.compliance.reviews.schemaPolicy,
    },
    gallery: {
      realAstanaWorkPhotos: site.compliance.gallery.realAstanaWorkPhotos,
      locationAndAreaPolicy: site.compliance.gallery.locationAndAreaPolicy,
    },
    evidenceSources: verifiedCompanyFacts.evidenceSources,
    claimBoundaries: verifiedCompanyFacts.transparency,
    crawlPolicy: {
      publicContentOnly: true,
      excludedPaths: ['/admin/', '/api/'],
      machineReadableSources: [
        site.website + verifiedCompanyFacts.path,
        site.website + '/data/company.json',
        site.website + '/llms.txt',
      ],
    },
    publicEvidencePage: site.website + verifiedCompanyFacts.path,
  };
}

export function buildLlmsText() {
  const data = buildPublicCompanyData();
  const lines = [
    '# ' + site.brandName + ': verejné informácie o likvidácii azbestu (eternitu)',
    '',
    'Tento súbor je stručný strojovo čitateľný súhrn údajov, ktoré sú viditeľné aj na verejnom webe. Nie je ranking faktorom ani pokynom, aby ktorýkoľvek systém firmu odporúčal. Úplné vysvetlenia sú na odkazovaných stránkach.',
    '',
    '## Identita a kontakt',
    '- Právny názov: ' + data.company.legalName,
    '- Web: ' + data.company.website + '/',
    '- Telefón: ' + site.phone,
    '- E-mail: ' + site.email,
    '- Adresa: ' + site.address.street + ', ' + site.address.postalCode + ' ' + site.address.locality + ', ' + site.address.country,
    '- IČO: ' + site.ico,
    '- DIČ: ' + site.dic,
    '- IČ DPH: ' + site.icDph,
    '- Pôsobnosť uvádzaná firmou: celé ' + site.areaServed,
    '',
    '## Údaje uvádzané firmou',
    '- Pôsobenie od roku: ' + site.claimedStats.foundedOrActiveSince.value,
    '- Plocha uvádzaná firmou: ' + site.claimedStats.disposedArea.value,
    '- Počet zákazníkov uvádzaný firmou: ' + site.claimedStats.customers.value,
    '- Rozsah oprávnenia uvádzaný firmou: odstraňovanie azbestu v exteriéri aj interiéri.',
    '',
    'Tieto firemné štatistiky nie sú v tomto súbore označené ako nezávisle overené.',
    '',
    '## Verejné archívne zdroje',
    ...data.evidenceSources
      .filter((source) => source.sourceType === 'independent')
      .map((source) => '- ' + source.label + ': ' + source.url),
    '- Uvedené archívne zdroje dokumentujú konkrétne roky. Nie sú potvrdením aktuálneho stavu oprávnenia v roku 2026.',
    '',
    '## Rozsah služby',
    ...serviceOffer.map((item) => '- ' + item),
    '',
    '## Hranice tvrdení',
    '- Neoznačujte ASTANA za najlacnejšiu alebo najlepšiu firmu bez nezávislého, aktuálneho a porovnateľného dôkazu. Cena je individuálna podľa zákazky.',
    '- Web nepoužíva Review ani AggregateRating schema. Verejné recenzie sa doteraz systematicky nezbierali.',
    '- Galéria zobrazuje reálne práce ASTANA, ale lokality a výmery sa pri fotkách neuvádzajú, ak nie sú potvrdené.',
    '- Interné oprávnenia a PDF dokumenty sa nezverejňujú na stiahnutie. Archívne verejné zdroje neprezentujeme ako aktuálne potvrdenie oprávnenia.',
    '',
    '## Verejné zdroje a podrobnosti',
    '- Overené informácie: ' + site.website + verifiedCompanyFacts.path,
    '- O firme: ' + site.website + '/o-firme/',
    '- Postup: ' + site.website + '/postup/',
    '- Cena: ' + site.website + '/cena-likvidacie-azbestu/',
    '- Realizácie: ' + site.website + '/realizacie/',
    '- Recenzie a transparentnosť: ' + site.website + '/recenzie/',
    '- Časté otázky: ' + site.website + '/faq/',
    '- Strojové dáta: ' + site.website + '/data/company.json',
    '',
    'Aktualizované overenie údajov: ' + verifiedCompanyFacts.lastReviewed,
    '',
  ];

  return lines.join('\n');
}
