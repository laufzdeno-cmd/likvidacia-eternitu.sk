import { transportPolicy } from './transport-policy.mjs';
import { pagePhotoId } from './public-photo-assignments';
import { getAzbestReference } from '../data/azbestReferences';

function articlePhoto(slug: string) {
  const photo = getAzbestReference(pagePhotoId(`/poradna/${slug}/`));
  return { photoId: photo.id, photoAlt: photo.alt, photoCaption: `${photo.title} – ASTANA, s.r.o.` };
}

export const adviceArticles = [
  {
    slug: 'co-je-eternit-a-kedy-obsahuje-azbest',
    title: 'Čo je eternit a kedy môže obsahovať azbest',
    description: 'Máte starú eternitovú strechu? Zistite, čo napovie vek a vzhľad krytiny, čo z fotografie neurčíme a aké údaje pripraviť na prvé posúdenie.',
    image: '/og/homepage.jpg', ...articlePhoto('co-je-eternit-a-kedy-obsahuje-azbest'),
    quickAnswer: 'Eternit je zaužívané označenie vláknocementovej krytiny a dosiek. Staršie výrobky môžu obsahovať azbest, novšie môžu byť bezazbestové. Vzhľad ani fotografia nie sú spoľahlivým dôkazom zloženia; pomôže dokumentácia výrobku, prípadne odborné posúdenie.',
    body: [
      ['Eternit a azbest nie sú to isté', 'Azbest označuje skupinu vláknitých minerálov. Eternitom ľudia bežne nazývajú vlnité dosky aj menšie strešné šablóny z vláknocementu. V minulosti sa pri ich výrobe používal aj azbest. Preto nie je správne považovať každý vláknocementový výrobok automaticky za azbestový, ani starú krytinu bez overenia vyhlásiť za bezpečnú.\n\nAk neviete, čo je na vašej streche, nemusíte materiál pomenovať odborne. V dopyte pokojne napíšte „staršia sivá krytina, zloženie nepoznám“.'],
      ['Čo napovie vek, tvar a označenie', 'Približný rok pokládky, stará faktúra, projekt alebo údaj o výrobcovi môžu zúžiť možnosti. Tvar dosiek, ich farba a povrch pomáhajú opísať situáciu, no nedokazujú chemické zloženie. Aj rôzne vyzerajúce krytiny môžu vyžadovať rovnakú opatrnosť.\n\nDoklady hľadajte medzi už dostupnými podkladmi. Kvôli značke na spodnej strane dosky krytinu neodoberajte a nelámte. Ak treba overenie vzorky, dohodnite si odborný postup odberu.'],
      ['Kedy treba spozornieť', 'Dôležitý je aj stav materiálu a plánované práce. Iná situácia je pri streche, do ktorej sa nezasahuje, a iná pri výmene, vŕtaní, rozoberaní alebo čistení. Pri narušení materiálu sa môžu uvoľňovať vlákna; neprítomnosť viditeľného prachu preto sama osebe nepotvrdzuje bezpečnosť.\n\nAk je krytina poškodená, opíšte rozsah a miesto poškodenia. Neopravujte ju brúsením či rezaním len preto, aby bola pripravená na obhliadku.'],
      ['Čo nám pomôže pri prvom posúdení', 'Pošlite obec, približnú plochu a informáciu, či sú dosky na streche, na obklade alebo už uložené na zemi. Ak máte bezpečne dostupné fotografie, hodí sa celkový pohľad na objekt a detail urobený bez dotýkania sa materiálu. Fotografie sú voliteľné.\n\nZ podkladov posúdime rozsah zákazky a vysvetlíme ďalší postup. Cenová ponuka na odstránenie a potvrdenie zloženia materiálu sú dve odlišné veci; z fotografie nebudeme sľubovať laboratórny výsledok.'],
      ['Ak spolu s krytinou meníte aj strechu', 'Už v prvom dopyte uveďte, či máte strechára a predbežný termín výmeny. Demontáž starej krytiny musí časovo nadväzovať na ďalšie práce. Vopred si treba dohodnúť aj ochranu odkrytého objektu, aby sa z plánovanej výmeny nestala improvizácia pri zmene počasia.'],
    ],
    checklistTitle: 'Na prvý kontakt si pripravte',
    checklist: ['Približný vek krytiny alebo dostupné doklady výrobku.', 'Odhad výmery a obec, v ktorej je objekt.', 'Informáciu o poškodení a o plánovaných zásahoch.', 'Fotky zo zeme, ak ich viete urobiť bezpečne.'],
    relatedSlugs: ['preco-neodstranovat-eternit-svojpomocne', 'co-poslat-pre-nacenenie-likvidacie-eternitu'],
    faqs: [
      { question: 'Dá sa azbest v eternite určiť iba podľa fotografie?', answer: 'Nie spoľahlivo. Fotografia pomáha posúdiť tvar, stav a rozsah materiálu, ale nepotvrdzuje jeho zloženie. Pri neistote sa vychádza z dokumentácie výrobku alebo odborného posúdenia.' },
      { question: 'Musím pred dopytom vedieť presný názov krytiny?', answer: 'Nie. Stačí opísať, čo na objekte máte, a uviesť, že si zložením nie ste istí. Približná výmera, lokalita a voliteľné fotografie pomôžu začať posúdenie.' },
    ],
  },
  {
    slug: 'preco-neodstranovat-eternit-svojpomocne',
    title: 'Prečo neodstraňovať eternit svojpomocne',
    description: 'Pri eternite nejde len o zloženie strechy. Prečítajte si, prečo sú dôležité oprávnenie, príprava pracoviska, odvoz odpadu a nadväznosť novej strechy.',
    image: '/og/postup.jpg', ...articlePhoto('preco-neodstranovat-eternit-svojpomocne'),
    quickAnswer: 'Odstraňovanie materiálu s obsahom azbestu zo stavieb patrí oprávnenej osobe. Svojpomocné rozoberanie prináša riziko expozície, pádu aj nesprávneho nakladania s odpadom. Odbornú firmu oslovte ešte pred zásahom do krytiny.',
    body: [
      ['Ušetrená demontáž môže pridať ďalšie starosti', 'Predstava býva jednoduchá: dosky zložíme sami a objednáme iba odvoz. Pri azbestovej krytine však nie je rozhodujúce len to, kto odvezie posledné vrece. Dôležitá je aj príprava pracoviska, kontrolovaná manipulácia a ochrana ľudí pri dome.\n\nPo rozbití alebo rozhádzaní dosiek sa situácia neposudzuje rovnako ako pri celej krytine na streche. Preto si postup nechajte vysvetliť skôr, než sa začne rozoberanie.'],
      ['Riziko sa nekončí pri viditeľnom prachu', 'Azbestové vlákna sa pri poškodzovaní materiálu môžu dostať do ovzdušia. Bežný pohľad neukáže, aká expozícia vznikla. Ani pekné počasie, otvorený dvor či obyčajné pracovné oblečenie nenahrádzajú posúdenie a opatrenia pri práci.\n\nTento článok nie je návod na svojpomocnú demontáž. Ak je materiál poškodený, obmedzte zbytočný prístup do jeho blízkosti a dohodnite odborné posúdenie.'],
      ['Treba riešiť aj prácu vo výške', 'Staršia krytina a strešná konštrukcia nemusia byť pochôdzne. Okrem samotného materiálu sa preto posudzuje výška, sklon, prístup a priestor pod strechou. Nechoďte na krytinu len kvôli meraniu alebo fotografii.\n\nDo dopytu uveďte, či sa k domu dostane pracovné vozidlo, či je pri fasáde miesto a či budova počas prác zostane v prevádzke. Tieto okolnosti pomáhajú pripraviť reálny rozsah prác.'],
      ['Odpad a doklady sú súčasťou zákazky', 'Materiál s obsahom azbestu sa nemá zmiešať s bežnou stavebnou suťou. Pri objednávke si vyjasnite, kto zabezpečí balenie, nakládku, odvoz a akú dokumentáciu dostanete. Samotná faktúra za prácu nemusí odpovedať na otázku, ako bol odpad odovzdaný.\n\nAk už dosky niekto zložil, opíšte ich skutočný stav. Kvôli fotografii ich nepresúvajte ani neprebaľujte. Aj už zložený materiál sa dá posúdiť bez toho, aby ste s ním znovu manipulovali.'],
      ['Ako pripraviť výmenu bez zbytočného čakania', 'Zlaďte si dve nadväzujúce práce: odstránenie starej krytiny a novú strechu. Overte termín, prípravu objektu a to, kto rieši dočasné zakrytie. Požadovaný deň nástupu uveďte ako požiadavku, nie ako hotovú dohodu. ASTANA potvrdí možný postup podľa stavby, kapacity a potrebných podkladov.'],
    ],
    checklistTitle: 'Pred objednaním si vyjasnite',
    checklist: ['Kto má oprávnenie na konkrétny druh odstraňovania.', 'Čo presne zahŕňa ponuka vrátane odpadu a dokladov.', 'Ako sa pripraví prístup a ochráni okolie pracoviska.', 'Kto a kedy prevezme strechu po demontáži.'],
    relatedSlugs: ['odvoz-a-balenie-azbestoveho-odpadu', 'ake-doklady-dostanete-po-likvidacii-azbestu'],
    faqs: [
      { question: 'Stačí objednať odvoz a krytinu si rozobrať sám?', answer: 'Pri materiáli s obsahom azbestu zo stavby treba riešiť oprávnenú realizáciu už od prípravy a demontáže. Objednanie odvozu nenahrádza správny postup pri predchádzajúcom rozoberaní.' },
      { question: 'Ako postupovať, keď sú eternitové dosky už zložené?', answer: 'Napíšte, kde ležia, aký je približný rozsah, či sú celé alebo poškodené a aký je prístup. Kvôli posúdeniu ich nerozbíjajte, neprekladajte ani svojpomocne neprebaľujte.' },
    ],
  },
  {
    slug: 'kolko-stoji-likvidacia-azbestu',
    title: 'Koľko stojí likvidácia azbestu',
    description: 'Porovnávate ceny odstránenia eternitu? Pozrite sa, čo má obsahovať ponuka, prečo sa líši cena rovnakej plochy a ako funguje doprava od 100 m².',
    image: '/og/cena-strecha-realizacia.jpg', ...articlePhoto('kolko-stoji-likvidacia-azbestu'),
    quickAnswer: 'Cena likvidácie azbestu závisí od plochy, materiálu, stavu, prístupu a dohodnutého rozsahu. Pre porovnanie ponúk potrebujete vedieť aj to, či zahŕňajú balenie, nakládku, odvoz, dokumentáciu a DPH. Samotná sadzba za m² nemusí byť konečná suma.',
    body: [
      ['Prečo dve rovnaké plochy nemusia stáť rovnako', 'Predstavte si nízku garáž s voľným príjazdom a vysoký dom v tesnom dvore. Aj pri rovnakej ploche krytiny sa líši prístup, manipulácia a príprava pracoviska. Ďalší rozdiel je medzi celými doskami na streche a poškodeným materiálom uloženým na viacerých miestach.\n\nPri nacenení preto nepomôže iba údaj „100 m²“. Stručný opis stavby umožní lepšie odhadnúť rozsah práce a zníži počet doplňujúcich otázok.'],
      ['Čo porovnávať v cenových ponukách', 'Pýtajte sa na rovnaký rozsah. Ponuka len na demontáž sa nedá priamo porovnať s ponukou, ktorá rieši aj balenie, nakládku, odvoz a podklady. Pri každej si overte, z akej výmery vychádza a čo sa stane, ak sa skutočný rozsah od odhadu líši.\n\nDôležitá je konečná suma a režim DPH, nie iba zvýraznená jednotková cena. Ak je niečo uvedené ako samostatná položka, má byť jasné, za čo sa účtuje a za akých podmienok.'],
      ['Ako funguje doprava pri ASTANE', `${transportPolicy.full}\n\nLokalitu potrebujeme aj pri ploche nad touto hranicou. Pomáha nám naplánovať výjazd, prístup k stavbe a odvoz materiálu. Pravidlo dopravy nemení potrebu posúdiť náročnosť demontáže, objem odpadu ani ostatné položky ponuky.`],
      ['Čo vám povie orientačný kalkulátor', 'Kalkulátor na cenovej stránke slúži na prvú predstavu podľa plochy a druhu materiálu. Nie je objednávkou ani potvrdením termínu. Výsledok nezohľadňuje všetky okolnosti konkrétneho objektu a nenahrádza cenovú ponuku s popísaným rozsahom.\n\nAk výmeru nepoznáte, použite odhad a označte ho. Neoplatí sa riskovať výstup na starú strechu len kvôli presnejšiemu číslu do formulára.'],
      ['Kedy môže byť potrebné ponuku spresniť', 'Dodatočne zistený neprístupný dvor, ďalšia plocha krytiny alebo odlišný stav materiálu môžu zmeniť podmienky zákazky. Preto je dobré oznámiť nejasnosti vopred a potvrdiť si, z akých podkladov firma vychádza.\n\nASTANE pošlite obec, približnú výmeru, typ objektu a informáciu, kde je materiál. Fotografie sú voliteľné. Ak máte svojho strechára, pripojte aj požiadavku na nadväznosť prác.'],
    ],
    checklistTitle: 'Pri porovnávaní ponúk skontrolujte',
    checklist: ['Rovnakú výmeru, druh materiálu a stavbu.', 'Demontáž, balenie, nakládku a odvoz v dohodnutom rozsahu.', 'Dokumentáciu, dopravu, individuálne položky a režim DPH.', 'Postup pri zmene rozsahu a podmienky potvrdenia termínu.'],
    relatedSlugs: ['ako-zmerat-strechu-pre-cenovu-ponuku', 'co-poslat-pre-nacenenie-likvidacie-eternitu'],
    faqs: [
      { question: 'Je cena za m² automaticky konečná cena zákazky?', answer: 'Nie vždy. Treba skontrolovať rozsah ponuky, dopravu, dokumentáciu, prípadné individuálne položky a DPH. Porovnávajte konečné sumy za rovnakú prácu.' },
      { question: 'Od akej plochy ASTANA neúčtuje dopravu po Slovensku?', answer: transportPolicy.full },
    ],
  },
  {
    slug: 'ake-doklady-dostanete-po-likvidacii-azbestu',
    title: 'Aké doklady dostanete po likvidácii azbestu',
    description: 'Čo si dohodnúť pred odstránením azbestu a ktoré podklady si uschovať po práci? Prehľad dokumentácie, odovzdania odpadu a údajov o zákazke.',
    image: '/og/postup.jpg', ...articlePhoto('ake-doklady-dostanete-po-likvidacii-azbestu'),
    quickAnswer: 'Po likvidácii si uschovajte potvrdenie alebo súvisiacu dokumentáciu v dohodnutom rozsahu, objednávku a faktúru. Pred začiatkom si vyjasnite, ktoré podklady firma odovzdá a kedy. Rozsah sa odvíja od stavby, materiálu a vykonaných prác.',
    body: [
      ['Doklady riešte už pri objednávke', 'Otázku „čo dostanem po práci“ netreba nechávať na odchod pracovníkov. V cenovej ponuke alebo pri jej potvrdení si overte, aký rozsah sa objednáva, kto rieši podklady pred prácami a aký výstup dostanete po ukončení.\n\nAk doklad potrebujete na konkrétny účel, napríklad pre správu objektu alebo k ďalšiemu konaniu, povedzte to vopred. Firma tak môže posúdiť požadovaný obsah bez sľubu, že jeden univerzálny dokument vyrieši každú situáciu.'],
      ['Objednávka, faktúra a doklad o odpade majú inú úlohu', 'Objednávka alebo potvrdená ponuka zachytáva dohodnutú prácu. Faktúra rieši jej vyúčtovanie. Potvrdenie či súvisiaca dokumentácia o nakladaní s materiálom zasa pomáha doložiť priebeh a výsledok zákazky. Tieto podklady si uschovajte spolu, aby na seba údaje nadväzovali.\n\nAk z dokumentu nie je jasné, ku ktorej stavbe alebo práci patrí, vypýtajte si vysvetlenie. Neposudzujte úplnosť iba podľa pečiatky alebo názvu formulára.'],
      ['Čo skontrolovať pri odovzdaní', 'Pozrite si označenie dodávateľa, identifikáciu zákazky, dátumy a opis vykonaného rozsahu. Ak dokument uvádza množstvo odpadu, overte, v akej jednotke je zapísané. Plocha krytiny v m² a hmotnosť odpadu nie sú zameniteľné veličiny.\n\nPri zákazke s viacerými etapami sa spýtajte, či podklad pokrýva celý rozsah alebo iba časť. Prípadné nezrovnalosti riešte, kým máte poruke objednávku a poznámky z realizácie.'],
      ['Nie všetky dokumenty vznikajú v rovnaký deň', 'Príprava podkladov pred prácami, samotná realizácia a následné odovzdanie dokumentácie sú rôzne kroky. Konkrétny termín a podmienky odovzdania si dohodnite s firmou. Pri ASTANE sa riaďte potvrdenou ponukou a dohodou ku konkrétnej zákazke.\n\nAk po práci na niečo čakáte, pošlite identifikáciu zákazky a pomenovanie chýbajúceho podkladu. Všeobecná správa „pošlite papiere“ sa dohľadáva ťažšie než konkrétna požiadavka.'],
      ['Ako si podklady jednoducho usporiadať', 'Vytvorte si priečinok k nehnuteľnosti a uložte doň ponuku, potvrdenie objednávky, faktúru a odovzdané doklady. Fotografie môžu byť doplnkom, no nepreukazujú samy osebe celý úradný ani odpadový postup.\n\nPri odovzdávaní ďalšiemu správcovi alebo vlastníkovi pomôže, keď je z podkladov zrejmé, ktorá časť objektu sa riešila. Osobné údaje a dokumenty nezverejňujte do verejnej recenzie.'],
    ],
    checklistTitle: 'Pri uzatváraní zákazky si odškrtnite',
    checklist: ['Mám potvrdený rozsah objednávky a jeho prípadné zmeny.', 'Viem, ktoré dokumenty boli odovzdané a na ktoré ešte čakám.', 'Údaje na podkladoch patria k mojej zákazke.', 'Všetky podklady mám uložené spolu s faktúrou.'],
    relatedSlugs: ['odvoz-a-balenie-azbestoveho-odpadu', 'kolko-stoji-likvidacia-azbestu'],
    faqs: [
      { question: 'Nahrádza faktúra za prácu všetky doklady o likvidácii?', answer: 'Faktúra slúži na vyúčtovanie. Rozsah potvrdenia a dokumentácie k vykonanej práci a odpadu si dohodnite osobitne; samotná faktúra nemusí tieto informácie obsahovať.' },
      { question: 'Čo uviesť pri žiadosti o chýbajúci doklad?', answer: 'Uveďte meno alebo firmu z objednávky, obec, termín realizácie a názov podkladu, ktorý potrebujete. Dokumenty a osobné údaje posielajte priamo firme, nie do verejnej recenzie.' },
    ],
  },
  {
    slug: 'ako-zmerat-strechu-pre-cenovu-ponuku',
    title: 'Ako zmerať strechu pre cenovú ponuku',
    description: 'Na prvú ponuku stačí bezpečný odhad výmery. Ukážeme rozdiel medzi pôdorysom a plochou krytiny aj jednoduchý príklad sedlovej strechy bez lezenia na ňu.',
    image: '/og/homepage.jpg', ...articlePhoto('ako-zmerat-strechu-pre-cenovu-ponuku'),
    quickAnswer: 'Pre prvú cenovú ponuku stačí odhad plochy krytiny v m². Najlepšie sú rozmery z projektu alebo existujúceho zamerania. Pôdorys domu nie je automaticky plocha šikmej strechy. Ak údaje nepoznáte, napíšte to; kvôli odhadu na starú krytinu nelezte.',
    body: [
      ['Začnite podkladmi, ktoré už máte', 'Pozrite sa do projektu, starého rozpočtu alebo ponuky strechára. Môže v nich byť uvedená plocha krytiny alebo rozmery jednotlivých strešných rovín. Do dopytu napíšte aj to, odkiaľ údaj pochádza.\n\nAk máte iba približné rozmery domu, pošlite ich spolu s opisom tvaru strechy. Označte, že ide o pôdorys, aby sme ho nepovažovali za zmeranú plochu krytiny.'],
      ['Jednoduchý príklad sedlovej strechy', 'Modelový príklad: jedna obdĺžniková strešná rovina má dĺžku 10 m a šikmú dĺžku od odkvapu po hrebeň 6 m. Jej plocha je 10 × 6 = 60 m². Ak je druhá rovina rovnako veľká, spolu je to približne 120 m².\n\nRozmer 6 m v tomto príklade znamená dĺžku po sklone strechy, nie vodorovnú vzdialenosť na zemi. Príklad ukazuje princíp výpočtu, nie dôvod ísť na strechu s metrom. Údaje prevezmite z bezpečne dostupných podkladov.'],
      ['Kedy jednoduchý výpočet nestačí', 'Valby, vikiere, prístavby a rozdielne strešné roviny môžu odhad skomplikovať. Jednotlivé časti treba rozlíšiť. Ak si nie ste istí, radšej pošlite jednoduchý náčrt a rozmery, ktoré poznáte, než presne vyzerajúce číslo bez podkladu.\n\nNapíšte aj to, či chcete odstrániť všetku krytinu alebo len určitú časť. Plocha novej krytiny v rozpočte strechára nemusí vždy zodpovedať rozsahu objednanej demontáže.'],
      ['Pri už zloženom materiáli opíšte jeho uloženie', 'Ak dosky nie sú na streche, pôvodná plocha môže byť iba orientačný údaj. Pre odvoz je dôležité aj ich množstvo, stav, uloženie a možnosť nakládky. Uveďte napríklad počet kôp či paliet a približné rozmery, ak ich poznáte.\n\nMateriál kvôli meraniu nerozoberajte a neprekladajte. Neznámu hmotnosť nenahrádzajte odhadom vydávaným za skutočné váženie.'],
      ['Čo spravíme s vaším odhadom', 'Odhad slúži na prvé posúdenie. Pri spresňovaní ponuky si potvrdíme rozsah a spôsob, akým sa overí skutočná výmera. Ak sa neskôr ukáže rozdiel, má byť zrejmé, z akých údajov pôvodná ponuka vychádzala.\n\nK ploche preto pridajte obec, typ objektu, približnú výšku a informáciu o prístupe. Fotografia celej stavby často pomôže vysvetliť situáciu lepšie než zložitý opis.'],
    ],
    checklistTitle: 'Do dopytu môžete napísať napríklad',
    checklist: ['Sedlová strecha, podľa projektu približne 120 m².', 'Rozmery poznám iba z pôdorysu domu; plocha krytiny je odhad.', 'Súčasťou sú aj dve menšie strechy nad prístavbou.', 'Na krytinu som kvôli meraniu nevstupoval; fotky mám zo zeme.'],
    relatedSlugs: ['co-poslat-pre-nacenenie-likvidacie-eternitu', 'kolko-stoji-likvidacia-azbestu'],
    faqs: [
      { question: 'Je pôdorys domu rovnaký ako výmera krytiny?', answer: 'Pri šikmej streche nie. Na plochu krytiny vplýva sklon aj tvar strechy. Ak poznáte len pôdorys, označte ho v dopyte ako pôdorys a pripojte opis strechy.' },
      { question: 'Ako vypočítať plochu dvoch rovnakých obdĺžnikových strešných rovín?', answer: 'Vynásobte dĺžku jednej roviny jej šikmou dĺžkou a výsledok zdvojnásobte. Rozmery berte z existujúcich podkladov; kvôli výpočtu na starú krytinu nevstupujte.' },
    ],
  },
  {
    slug: 'co-poslat-pre-nacenenie-likvidacie-eternitu',
    title: 'Čo poslať pre nacenenie likvidácie eternitu',
    description: 'Pripravte dopyt bez zbytočného vypisovania. Lokalita, odhad plochy, stav materiálu a prístup pomôžu pripraviť ponuku; fotky zostávajú voliteľné.',
    image: '/og/realizacie.jpg', ...articlePhoto('co-poslat-pre-nacenenie-likvidacie-eternitu'),
    quickAnswer: 'Na začiatok stačí obec, približná výmera a kontakt na vás. Doplňte, či je materiál na streche alebo už zložený a či po demontáži pokračuje strechár. Fotografie nie sú povinné. Údaj, ktorý neviete, označte ako odhad alebo neznámy.',
    body: [
      ['Tri údaje, od ktorých sa vieme odraziť', 'Obec určí lokalitu zákazky. Približná plocha pomôže odhadnúť rozsah. Kontakt potrebujeme, aby sme si mohli vyjasniť otázky a poslať ponuku. Prvý dopyt nemusí byť technická správa ani presné zameranie.\n\nVo formulári vyberiete aj typ materiálu a objektu. Ak zloženie nepoznáte, pri materiáli zvoľte možnosť Neviem posúdiť. Približnú výmeru pokojne označte ako odhad.'],
      ['Napíšte, kde materiál je a v akom je stave', 'Rozdiel je medzi krytinou na streche, doskami na fasáde a materiálom uloženým na dvore. Pri už zložených doskách pomôže opis uloženia, približného množstva a poškodenia. Ak ide o viac budov, uveďte ich oddelene.\n\nMateriál kvôli dopytu nepripravujte rozoberaním, lámaním alebo premiestňovaním. Najprv potrebujeme poznať skutočný stav, aby sa ďalší postup neprispôsoboval už vykonanému zásahu.'],
      ['Aké fotografie pomôžu', 'Ak ich máte, vyberte celkový pohľad na objekt, detail krytiny urobený z bezpečného miesta a prístupovú cestu alebo dvor. Pri odvoze už zloženého odpadu je užitočný aj pohľad na jeho uloženie.\n\nFotografie nemusia byť profesionálne. Dôležitejšie je, aby vysvetľovali situáciu. Nevstupujte kvôli nim na strechu, nedotýkajte sa poškodeného materiálu a neposielajte zbytočne doklady či údaje nesúvisiace so zákazkou.'],
      ['Termín a prístup často rozhodnú viac než ďalšia fotka', 'Napíšte, či sa pri objekte dá zastaviť, či vedie na pozemok úzky vjazd a či je budova v prevádzke. Ak máte strechára, uveďte jeho plánovaný nástup a to, čo už máte dohodnuté.\n\nPožadovaný dátum berieme ako podklad na plánovanie. Potvrdený termín vzniká až po posúdení rozsahu, kapacity, počasia a potrebného postupu pred prácami.'],
      ['Čo sa deje po odoslaní', 'Podklady použijeme na posúdenie zákazky. Ak niečo podstatné chýba, ozveme sa s doplňujúcou otázkou. Následne dostanete konkrétnu cenovú ponuku a vysvetlenie ďalšieho postupu. Odoslaním dopytu sa automaticky neobjednáva realizácia.\n\nAk sa okolnosti zmenia, doplňte ich v rovnakej komunikácii. Jedna aktuálna verzia údajov pomáha viac než niekoľko rozdielnych dopytov k tomu istému objektu.'],
    ],
    checklistTitle: 'Krátky vzor správy',
    checklist: ['Obec a typ objektu; približná výmera s označením, že ide o odhad.', 'Materiál je na streche / už zložený, jeho názov poznám / nepoznám.', 'Prístup vozidla a prípadné obmedzenia na pozemku.', 'Požadovaný termín, strechár a kontakt; fotografie, ak ich máte.'],
    relatedSlugs: ['ako-zmerat-strechu-pre-cenovu-ponuku', 'co-je-eternit-a-kedy-obsahuje-azbest'],
    faqs: [
      { question: 'Môžem poslať dopyt aj bez fotografií?', answer: 'Áno. Fotografie sú voliteľné. Začnite lokalitou, približnou výmerou a opisom situácie; ak bude treba ďalší podklad, dohodneme sa na jeho doplnení.' },
      { question: 'Objednávam si odoslaním formulára realizáciu?', answer: 'Nie. Dopyt je podklad pre nezáväznú cenovú ponuku a posúdenie ďalšieho postupu. Rozsah a termín sa potvrdzujú individuálne.' },
    ],
  },
  {
    slug: 'azbest-v-interieri-vs-exterieri',
    title: 'Azbest v interiéri a exteriéri: v čom je rozdiel',
    description: 'Strecha a technický priestor potrebujú odlišnú prípravu. Čo uviesť pri podozrení na azbest vnútri budovy a čo pri vonkajšej krytine či obklade?',
    image: '/og/faq.jpg', ...articlePhoto('azbest-v-interieri-vs-exterieri'),
    quickAnswer: 'Pri streche sa rieši najmä výška, prístup, počasie a nadväznosť novej krytiny. V interiéri je zásadný spôsob oddelenia pracoviska od používaných priestorov. Vhodný postup aj potrebný rozsah oprávnenia závisia od konkrétneho materiálu a stavby.',
    body: [
      ['Nestačí označiť zákazku slovom azbest', 'Pod týmto názvom sa môže skrývať strešná doska, obklad aj materiál v technickom priestore. Typ, stav a umiestnenie ovplyvňujú spôsob posúdenia. Plocha sama preto nevystihuje náročnosť dvoch odlišných zákaziek.\n\nAk zloženie nepoznáte, nepokúšajte sa ho overovať poškodením materiálu. Opíšte miesto, dostupné označenie a plánované práce. Fotografia pomôže pri orientácii, nie ako potvrdenie zloženia.'],
      ['Exteriér: krytina, prístup a okolie domu', 'Pri streche pomáha údaj o výške, sklone a možnosti príjazdu. Treba vedieť aj to, čo je pod pracoviskom a kde bude možné manipulovať so zabaleným materiálom. Vonkajšie umiestnenie neznamená, že sa môže s odpadom nakladať bez obmedzení.\n\nAk po demontáži pokračuje strechár, časový plán musí počítať s odovzdaním pracoviska a ochranou odkrytého objektu. Túto nadväznosť si vyjasnite ešte pred potvrdením termínu.'],
      ['Interiér: čo ostáva v prevádzke', 'Vnútri budovy popíšte, o aký priestor ide, ako sa doň vstupuje a či susedné miestnosti používajú ľudia. Dôležité môže byť prepojenie s chodbami, rozvodmi či ďalšími časťami budovy. Spôsob zabezpečenia pracoviska musí určiť oprávnená firma podľa konkrétnej situácie.\n\nNepredpokladajte, že postup zo strechy možno bez zmeny preniesť do interiéru. Pri objednávke sa pýtajte na vhodnosť oprávnenia a rozsah prác pre daný typ priestoru.'],
      ['Čo poslať, keď spravujete firemný objekt', 'Uveďte kontaktnú osobu na mieste, režim vstupu, prevádzkové obmedzenia a rozsah, ktorý chcete riešiť. Ak máte plán alebo existujúcu dokumentáciu materiálov, spomeňte ju v dopyte. Nemusíte hneď posielať celý projekt.\n\nPri viacerých zónach rozlíšte, ktoré budú prístupné a ktoré ostanú používané. Dôležitá je skutočná situácia v čase realizácie, nie len stav zachytený v starom výkrese.'],
      ['Kde nájdete ďalšie informácie', 'Tento web sa sústreďuje najmä na eternitové strechy, cenu a nadväznosť so strechármi. Ak riešite azbest v interiéri alebo inú špecializovanú situáciu, uveďte to pri kontakte s ASTANOU. Vhodný rozsah zákazky si potvrdíme individuálne; všeobecný opis na webe nenahrádza posúdenie priestoru.'],
    ],
    checklistTitle: 'Rozdiely, ktoré uveďte v dopyte',
    checklist: ['Strecha, fasáda alebo konkrétny vnútorný priestor.', 'Stav materiálu a to, či sa doň už zasahovalo.', 'Prístup pracovníkov, techniky a režim používania budovy.', 'Dokumentáciu, ktorú máte k dispozícii, a požadovaný rozsah.'],
    relatedSlugs: ['co-je-eternit-a-kedy-obsahuje-azbest', 'odvoz-a-balenie-azbestoveho-odpadu'],
    faqs: [
      { question: 'Môže sa pri interiéri použiť rovnaký postup ako na streche?', answer: 'To sa nedá rozhodnúť všeobecne. Postup závisí od materiálu, priestoru, jeho prepojenia s budovou a požadovaného rozsahu oprávnenia. Posúdi ho oprávnená firma.' },
      { question: 'Čo opísať pri azbeste v budove, ktorá zostáva v prevádzke?', answer: 'Uveďte používané a odstavené priestory, režim vstupu, prístupové cesty, kontaktnú osobu a plánované zásahy. Podľa toho sa pripraví posúdenie pracoviska a ďalšieho postupu.' },
    ],
  },
  {
    slug: 'odvoz-a-balenie-azbestoveho-odpadu',
    title: 'Odvoz a balenie azbestového odpadu',
    description: 'Máte eternit už zložený alebo plánujete demontáž? Zistite, čo treba posúdiť pri balení, nakládke, prístupe a odvoze bez ďalšej manipulácie svojpomocne.',
    image: '/og/cena.jpg', ...articlePhoto('odvoz-a-balenie-azbestoveho-odpadu'),
    quickAnswer: 'Balenie a odvoz materiálu s obsahom azbestu sú súčasťou odborného postupu. Ak je eternit už zložený, popíšte jeho stav, množstvo, uloženie a prístup. Neprekladajte ho ani neprebaľujte kvôli dopytu; vhodný spôsob manipulácie treba najprv posúdiť.',
    body: [
      ['Demontáž a samostatný odvoz sú rôzne zadania', 'Pri celej krytine na streche ponuka počíta s jej odstránením. Pri už zloženom materiáli sa posudzuje existujúci stav a možnosti ďalšieho nakladania. Samotná veta „potrebujem odviezť eternit“ preto ešte nevystihuje rozsah zákazky.\n\nNapíšte, či sú dosky celé alebo poškodené, na koľkých miestach ležia a či je pri nich priestor na prístup. Ak pôvodnú výmeru nepoznáte, opíšte množstvo bez vymýšľania presnej hmotnosti.'],
      ['Prečo rozhoduje aj uloženie materiálu', 'Dosky pri prístupnom dvore a materiál za budovou bez príjazdu vyžadujú iné plánovanie. Podstatná je cesta medzi uložením a miestom nakládky, nie len vzdialenosť objektu od hlavnej cesty.\n\nAk sú v ceste schody, úzky priechod alebo zamknutý areál, uveďte to. Pri prvom posúdení pomôže celková fotografia miesta. Neodkrývajte ani nepresúvajte materiál len kvôli lepšiemu záberu.'],
      ['Balenie musí nadväzovať na ďalšie nakladanie', 'Cieľom nie je len vytvoriť upravenú kopu na dvore. Materiál sa musí pripraviť tak, aby s ním bolo možné ďalej bezpečne manipulovať a odovzdať ho určeným spôsobom. Vhodnosť existujúceho balenia preto nemožno potvrdiť iba podľa jeho vonkajšieho vzhľadu.\n\nTento text nie je návod na balenie azbestu svojpomocne. Ak už máte materiál v obaloch, opíšte ich a nechajte si posúdiť ďalší postup bez zbytočného zásahu.'],
      ['Čo si potvrdiť v ponuke na odvoz', 'Vyjasnite si, či ponuka zahŕňa posúdenie uloženia, prípadnú potrebnú manipuláciu, balenie v dohodnutom rozsahu, nakládku, prepravu a následné doklady. Overte aj spôsob určenia množstva a podmienky pri odlišnom rozsahu.\n\nNevychádzajte z predpokladu, že akýkoľvek zberný dvor materiál prevezme. Možnosti odovzdania a podmienky prijatia sa musia overiť pre konkrétny odpad.'],
      ['Po odvoze si uzavrite aj dokumentáciu', 'Po vykonaní zákazky si skontrolujte dohodnutý rozsah a odovzdané podklady. Uschovajte ich spolu s ponukou a faktúrou. Ak dokumentácia prichádza následne, majte dohodnutý postup jej doručenia.\n\nPri ASTANE začnite nezáväzným dopytom s obcou, odhadom množstva a opisom uloženia. Ak ide zároveň o ďalšiu demontáž, rozlíšte obe časti, aby sa pri nacenení niektorá nestratila.'],
    ],
    checklistTitle: 'Pre posúdenie samostatného odvozu',
    checklist: ['Obec, miesto uloženia a približné množstvo materiálu.', 'Celé alebo poškodené dosky, voľne uložené alebo v existujúcich obaloch.', 'Možnosť príjazdu a cesta k miestu nakládky.', 'Fotografia z bezpečného odstupu, ak ju máte; bez premiestňovania odpadu.'],
    relatedSlugs: ['ake-doklady-dostanete-po-likvidacii-azbestu', 'co-poslat-pre-nacenenie-likvidacie-eternitu'],
    faqs: [
      { question: 'Máte možnosť posúdiť odvoz eternitu, ktorý už niekto zložil?', answer: 'Áno, pošlite lokalitu, opis množstva, stavu a uloženia a možnosti prístupu. Ďalší postup a cenu treba potvrdiť podľa skutočnej situácie.' },
      { question: 'Treba dosky pred posúdením odvozu premiestniť k bráne?', answer: 'Nie kvôli dopytu. Opíšte, kde sa nachádzajú, a nechajte si posúdiť manipuláciu. Zbytočné presúvanie alebo poškodzovanie materiálu môže zhoršiť podmienky na mieste.' },
    ],
  },
] as const;
