import { serviceDocumentationOutcome } from '../content/site';
import { transportPolicy } from '../content/transport-policy.mjs';

export const homeContentVersion = '2026-05-23-proof-cleanup-v10';

export const homeContentDefaults = {
  heroEyebrow: 'Kompletné riešenie azbestu a eternitu',
  heroTitle: 'Likvidácia azbestu a eternitu po celom Slovensku',
  heroClaim: 'Pošlite nám približnú výmeru a obec. O ďalší postup sa postaráme my.',
  heroText:
    `Zabezpečíme potrebné podklady, bezpečnú demontáž, balenie a odvoz. Výsledkom je ${serviceDocumentationOutcome}.`,
  quoteKicker: 'Rýchla cenová ponuka',
  quoteTitle: 'Jednoduchý formulár',
  quoteIntro: 'Stačí približná výmera, lokalita a kontakt. Ozveme sa do 24 hodín.',
  quoteHandled: 'Vy riešite výmeru. My riešime zvyšok.',
  quotePriorityTitle: 'm2 je hlavný údaj',
  quotePriorityText: 'Fotky nám pomôžu overiť materiál, prístup a náročnosť práce.',
  formSubmitText: 'Získať cenovú ponuku',
  ctaPrimary: 'Chcem cenovú ponuku',
  ctaPhone: 'Zavolať 0905 217 946',
  includedEyebrow: 'Čo všetko vybavíme za vás',
  includedTitle: 'Všetko potrebné okolo azbestu',
  includedText: 'Dokumentácia, demontáž, balenie, odvoz aj doklady v jednom postupe.',
  processEyebrow: 'Postup v praxi',
  processTitle: 'Od výmery po doklady',
  riskEyebrow: 'Bezpečný postup',
  riskTitle: 'Azbest nie je obyčajná strešná krytina',
  riskText:
    'Azbest nestačí iba zložiť zo strechy. Rozhoduje manipulácia, odvoz a doklady po likvidácii. Preto riešime postup ku konkrétnej stavbe — od podkladov a rozhodnutí až po dokumentáciu.',
  riskNoticeTitle: 'Bez dokladov neriskujte',
  riskNoticeText:
    'Pred začiatkom prác si overte, že firma rieši doklady k vašej stavbe. Potrebný postup a dokumentáciu pripravujeme v rámci zákazky.',
  cautionEyebrow: 'Na čo si dať pozor pri výbere firmy',
  cautionTitle: 'Na čo si dať pozor pri výbere firmy',
  cautionText:
    'Pri azbeste nerozhoduje iba cena. Dôležité je, či firma rieši dokumentáciu, bezpečnú manipuláciu, balenie, odvoz aj doklady.',
  roofersEyebrow: 'Zladenie so strechármi',
  roofersTitle: 'Máte strechára? Zladíme sa. Nemáte? Pomôžeme nájsť.',
  roofersText:
    'Pri výmene strechy rozhoduje načasovanie. Eternit demontujeme tak, aby mohli strechári čo najplynulejšie pokračovať a strecha nezostala zbytočne otvorená.',
  roofersCtaPrimary: 'Nájsť strechára podľa regiónu',
  roofersCtaSecondary: 'Chcem cenovú ponuku',
  whyEyebrow: 'Prečo ASTANA',
  whyTitle: 'Prečo sa zákazníci obracajú na ASTANA',
  whyText:
    'Nie sme firma, ktorá len zloží eternit zo strechy. Riešime dokumentáciu ku konkrétnej stavbe, stabilizáciu, kontrolovanú demontáž, balenie, odvoz aj doklady po likvidácii.',
  realizationsEyebrow: 'Vybrané realizácie',
  realizationsTitle: 'Naše realizácie',
  realizationsText:
    'Pozrite si ukážky našej práce pri odstraňovaní azbestu (eternitu), balení a odvoze odpadu.',
  testimonialsEyebrow: 'Referencie',
  testimonialsTitle: 'Čo hovoria zákazníci',
  testimonialsText: 'Krátke skúsenosti zákazníkov po realizácii a odovzdaní zákazky.',
  testimonialFormTitle: 'Napíšte referenciu po realizácii',
  testimonialFormText: 'Referenciu pred zverejnením skontrolujeme a zobrazíme až po schválení.',
  practiceEyebrow: 'Proces v praxi',
  practiceTitle: 'Stabilizácia, demontáž a balenie v praxi',
  practiceText:
    'Doplnkové zábery ukazujú, ako sa materiál stabilizuje, demontuje a pripravuje na odvoz bez zbytočného chaosu na stavbe.',
  faqEyebrow: 'FAQ',
  faqTitle: 'Najčastejšie otázky',
  faqText: 'Krátke odpovede na veci, ktoré ľudia riešia pred cenovou ponukou.',
  finalEyebrow: 'Rýchla odpoveď',
  finalTitle: 'Vy riešite výmeru. My riešime zvyšok.',
  finalText:
    'Zadajte približnú výmeru v m2, lokalitu a typ materiálu. O dokumentáciu, demontáž, balenie, odvoz aj potvrdenie sa postaráme my.',
  finalCtaPrimary: 'Získať cenovú ponuku',
  footerText:
    'Likvidácia azbestu a eternitu po celom Slovensku. Cenová ponuka, dokumentácia, demontáž, balenie, odvoz a potvrdenie.',
  trustItems:
    `Firma ASTANA pôsobí od roku 2011|Pôsobíme na trhu od roku 2011.\nPôsobíme po celej SR|Zákazky riešime podľa lokality a kapacity\n${transportPolicy.title}|${transportPolicy.full}\nRÚVZ / OÚŽP ku konkrétnej stavbe|Postup riešime legálne, nie iba všeobecným sľubom\nDoklady po likvidácii|Potvrdenie / dokumentácia po úhrade`,
  includedItems:
    'Oznámenie prác a podklady pre RÚVZ\nPodklady pre OÚŽP / životné prostredie\nDokumentácia k nakladaniu s nebezpečným odpadom\nStabilizácia materiálu\nOdborná demontáž\nDekontaminácia pracovného priestoru\nBalenie do označených vriec\nOdvoz na skládku nebezpečného odpadu\nPotvrdenie / dokumentácia po legálnej likvidácii',
  processSteps:
    'Zadáte m2 a údaje|Uveďte približnú výmeru, lokalitu a typ materiálu.\nPriložíte fotky, ak ich máte|Fotky pomôžu spresniť prístup, výšku, stav strechy a náročnosť.\nPripravíme cenovú ponuku|Na základe m2, lokality a typu materiálu pripravíme nezáväznú ponuku.\nPo objednávke vybavíme doklady a termín|Pripravíme potrebný postup, podklady a dohodneme realizáciu.\nZrealizujeme demontáž, odvoz a odovzdáme doklady|Materiál stabilizujeme, odoberáme kontrolovane, zabalíme ho a po ukončení odovzdáme súvisiacu dokumentáciu.',
  riskItems:
    'Zdravotné riziko|Pri neodbornej manipulácii môžu vznikať nebezpečné vlákna a prach.\nÚradný postup|Pri azbeste sa rieši postup a dokumentácia podľa konkrétnej zákazky.\nNebezpečný odpad|Azbest nepatrí do bežného odpadu. Musí byť správne zabalený a odovzdaný.\nDoklady|Po legálnej likvidácii získate potrebné potvrdenie alebo dokumentáciu.',
  cautionItems:
    'Pýtajte si doklady ku konkrétnej stavbe|Nestačí počuť „máme oprávnenie“. Pri plánovaných prácach držiteľ oprávnenia oznamuje odstraňovanie RÚVZ najmenej 30 dní vopred a prikladá požadované podklady. Firma vám má vedieť vysvetliť postup pre vašu stavbu.\nPozor na odpad ponechaný na dvore|Likvidácia nekončí demontážou. Azbestový odpad musí byť zabalený a odvezený na určené miesto.\nPozor na zhadzovanie eternitu|Materiál sa má demontovať kontrolovane. Zhadzovanie môže zhoršiť riziko prachu, poškodenia a chaosu na stavbe.\nPozor na cenu bez dokladov|Nízka cena môže znamenať, že v nej nie je zahrnutá dokumentácia, skládka, balenie alebo odvoz.\nPozor na meškanie termínu|Ak demontáž mešká, strechári čakajú a strecha môže zostať otvorená. Preto termíny plánujeme vopred a sledujeme počasie.\nPozor na zálohu bez istoty|Pri bežných zákazkách neplatíte vopred za samotnú realizáciu. Platba prebieha po dokončení podľa dohodnutého rozsahu.',
  rooferItems:
    'Zladenie termínu|Práce plánujeme v pracovných dňoch od 8:00 do 18:00. Konkrétny čas nástupu dohodneme podľa lokality, počasia a nadväznosti so strechármi.\nSledujeme počasie|Termín plánujeme s ohľadom na počasie, rozsah prác a nadväznosť strechárskych prác.\nBez zhadzovania eternitu|Materiál demontujeme kontrolovane. Nezhadzujeme eternit zo strechy a nevytvárame zbytočný chaos na stavbe.\nStabilizácia materiálu|Pred manipuláciou sa materiál stabilizuje, aby sa znížilo riziko uvoľňovania prachu.\nPomoc so strechárom|Ak nemáte svojho strechára, môžete si vybrať partnera podľa regiónu alebo o odporúčanie požiadať v cenovej ponuke.\nPlatba po dokončení|Pri bežných zákazkách nevyžadujeme platbu vopred za samotnú realizáciu. Platba prebieha po dokončení podľa dohodnutého rozsahu.',
  practiceItems:
    'Stabilizácia materiálu|Materiál sa pred manipuláciou pripraví tak, aby sa znížilo riziko uvoľňovania prachu.\nOdborná demontáž|Práca prebieha kontrolovane, bez zbytočného lámania a chaosu na stavbe.\nBalenie do označených vriec|Azbestový odpad sa balí do určených obalov a pripraví na bezpečný odvoz.\nOdvoz na skládku nebezpečného odpadu|Materiál sa odvezie na určené miesto podľa typu zákazky a dohodnutého postupu.\nOdovzdanie dokladov|Po ukončení a úhrade zákazky odovzdávame potvrdenie alebo súvisiacu dokumentáciu.',
  whySafeText: 'Materiál stabilizujeme a demontujeme kontrolovane, bez zbytočného lámania.',
  whyDocumentationText: 'Potrebné podklady riešime ku konkrétnej stavbe a zákazke.',
  whyRemovalText: 'Zabezpečíme demontáž, balenie a odvoz podľa dohodnutého rozsahu.',
  whyExperienceText: 'Firma ASTANA pôsobí na trhu od roku 2011.',
  whyPricingText: 'Cenovú ponuku pripravíme podľa výmery, lokality a typu materiálu.',
  whyCoverageText: 'Zákazky riešime po celom Slovensku podľa rozsahu a kapacity.',
  faqItems:
    'Je azbest nebezpečný?|Materiály s obsahom azbestu môžu byť problém najmä pri poškodení, lámaní alebo neodbornej manipulácii. Preto je dôležitý odborný postup, stabilizácia, balenie a správne odovzdanie odpadu.\nMôžem eternit odstrániť svojpomocne?|Pri azbeste nejde iba o fyzické odstránenie krytiny. Treba riešiť bezpečnú manipuláciu, balenie, odvoz na určené miesto a doklady.\nTreba na práce povolenie od RÚVZ?|Pri plánovanom odstraňovaní azbestu držiteľ oprávnenia písomne oznamuje práce príslušnému RÚVZ najmenej 30 dní vopred a predkladá požadované podklady. Ide o oznámenie, nie o žiadosť o povolenie. ASTANA pripraví postup ku konkrétnej stavbe a po dokončení odovzdá dohodnuté doklady vrátane potvrdenia o likvidácii.\nStačí, že firma má oprávnenie na odstraňovanie azbestu?|Je potrebné overiť, či rozsah oprávnenia zodpovedá konkrétnemu typu prác a či firma pripraví oznámenie a podklady ku konkrétnej stavbe.\nČo ak neviem presnú výmeru?|Stačí približná výmera v m2. Ak neviete presne, uveďte odhad. Presné m2 sa overia podľa skutočnosti a rozsahu prác.\nPotrebujete fotky?|Fotky sú voliteľné, ale veľmi pomôžu. Podľa nich vieme lepšie posúdiť typ materiálu, prístup, výšku objektu, stav strechy a náročnosť.\nČo dostanem po likvidácii?|Po riadnom ukončení a úhrade zákazky odovzdávame potvrdenie alebo súvisiacu dokumentáciu podľa rozsahu a typu zákazky.\nKedy môže začať realizácia?|Termín závisí od rozsahu, lokality, počasia a potrebného postupu pred prácami. Po potvrdení objednávky dohodneme ďalší postup a časový plán.\nPomôžete zladiť likvidáciu so strechárom?|Áno. Práce plánujeme v pracovných dňoch od 8:00 do 18:00 a konkrétny čas nástupu dohodneme podľa lokality, počasia a nadväznosti so strechárom.',
};

/**
 * Only fields rendered by the current homepage belong in the owner-facing CMS.
 * Legacy defaults remain available for backwards compatibility, but must not
 * create controls whose saved value has no public effect.
 */
export const homepageEditableKeys = [
  'heroEyebrow',
  'heroTitle',
  'heroClaim',
  'heroText',
  'quoteKicker',
  'quoteTitle',
  'quoteIntro',
  'quoteHandled',
  'quotePriorityTitle',
  'quotePriorityText',
  'formSubmitText',
  'ctaPrimary',
  'ctaPhone',
  'realizationsEyebrow',
  'realizationsTitle',
  'realizationsText',
  'includedEyebrow',
  'includedTitle',
  'includedText',
  'includedItems',
  'processTitle',
  'processSteps',
  'riskEyebrow',
  'riskTitle',
  'riskText',
  'riskNoticeText',
  'cautionTitle',
  'roofersTitle',
  'roofersText',
  'roofersCtaSecondary',
  'rooferItems',
  'whyTitle',
  'trustItems',
  'faqEyebrow',
  'faqTitle',
  'faqText',
  'faqItems',
  'finalEyebrow',
  'finalTitle',
  'finalText',
  'finalCtaPrimary',
  'footerText',
] as const satisfies readonly (keyof typeof homeContentDefaults)[];
