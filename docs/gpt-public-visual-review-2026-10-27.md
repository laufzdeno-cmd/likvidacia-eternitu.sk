# GPT kontrolór – verejné podstránky ASTANA

## Konečné vizuálne prijatie – PASS

**Konečný verdikt: PASS pre lokálneho kandidáta `kbSH6Gh5iiJGQkOzZHw3n`.** F1–F8 sú uzavreté. V schválenom grafickom rozsahu nezostala známa blokujúca vada. Nižšie uvedené RETURN verdikty sú história predchádzajúcich kandidátov.

### Presná identita a rozsah dôkazu

- Kandidát: `tmp/review-layout/candidate-1793099865231`, BUILD_ID `kbSH6Gh5iiJGQkOzZHw3n`, lokálne http://127.0.0.1:3147/.
- Zdrojový fingerprint: `f5f94766a56989246b3c1def0e7e4436e86dee36579b7ba0499f1a88d8a70b34`.
- Kontrolór **nezávisle prepočítal SHA-256 všetkých 802 ciest** zo zdrojového fingerprintu v starom aj novom kandidátovi. Nový kandidát má 0 odchýlok voči fingerprintu. Voči predchádzajúcemu `CutYIWNT_m0fzhq1O1GCf` sa zmenil **iba `app/realizations-gallery-client.tsx`**, ostatných 801 kontrolovaných súborov je byte-identických. Dôkaz `tmp/gpt-public-visual-review/recheck-04-gallery/delta.json`.
- Priamo prečítaná delta pridáva posun skrytého filtra po výbere a pri focus-visible, s cleanup listenera. Filtrovanie, kategórie ani volanie analytickej udalosti nezmenila. Prijatie ostatných obrazoviek preto zostáva podložené predchádzajúcimi vlastnými 105 renderami, 79 jedinečnými fotografickými identitami a 30 cielenými regresnými renderami; nejde o tvrdenie, že všetky tieto renderovania boli zbytočne opakované aj vo štvrtom kole.

### F7 – posledná oprava nezávisle prijatá

Všetkých sedem filtrov bolo na každej šírke reálne kliknutých a následne samostatne prejdených **siedmimi natívnymi Tab krokmi**. Geometria textových riadkov sa merala voči skutočnej viditeľnej ploche pásu po 350 ms aj po 1 s, popri screenshotovom posúdení. Žiadny klik sa nestratil posunom počas pointer fokusu.

| Šírka | Kliknuté filtre | Klávesnicové kroky | Orezaný aktívny/fokusovaný názov | Stratený klik alebo fokus |
| --- | --- | --- | --- | --- |
| 1440 px | 7/7 | 7/7 | 0 | 0 |
| 390 px | 7/7 | 7/7 | 0 | 0 |
| 320 px | 7/7 | 7/7 | 0 | 0 |

**42/42 stavov PASS.** Pri každom kliknutí sa potvrdilo `aria-pressed=true`; každý očakávaný klávesnicový cieľ mal skutočný fokus. Hospodárske budovy pri 390 px aj Rodinné domy pri 320 px sú po výbere už celé čitateľné. Dlhý posledný názov zostáva v dvoch riadkoch a vojde sa do plochy. Prvý aj posledný klávesnicový fokus má viditeľný tmavý 3px obrys; text ani obrys sa významovo nestrácajú za okrajom. Čiastočný náhľad susednej neaktívnej položky zostáva bežnou signalizáciou posúvateľnej lišty.

Dôkazy v `tmp/gpt-public-visual-review/recheck-04-gallery/`: `all-filters.json` (42 stavov), všetkých 21 kliknutých screenshotov, `keyboard-frames.json`, `390/320-keyboard-first.png`, `390/320-keyboard-last.png`, najmä opravené `390-filter-2-settled.png` a `320-filter-1-settled.png`. Kontrolór prezrel tieto skutočné nové snímky; nepoužil vloženú diagnostickú CSS ani zelený test ako náhradu vizuálneho posúdenia.

### Čo tento PASS znamená

- Vizuál, rozloženie a ľudský text v dohodnutom verejnom rozsahu sú prijaté podľa vyššie uvedeného reťazca vlastných dôkazov. Recenzný dotazník je prvý, používa hviezdičky a zelené CTA; pôvodné kontrastné, odsadzovacie a mobilné vady sú uzavreté. Verejný statický fotografický výber má 79 slotov bez opakovania identity.
- Toto je **lokálne prijatie pripraveného kandidáta**, nie tvrdenie o nasadení na likvidacia-eternitu.sk, produkčnom retenčnom crone alebo o indexácii Google.
- Bez produkčnej DB zostávajú neoverené reálne schválené recenzie a dynamické zákaznícke fotografie, súkromné tokenové obrazovky, reálne odoslanie formulára/e-mailu, Gmail OAuth a admin. Právna správnosť, fyzický iPhone/Safari a reálne CWV nemajú týmto grafickým auditom nové potvrdenie.
- Browser používal iba loopback GET/HEAD, so zamietnutou analytikou a marketingom. Nič sa neodoslalo, nezverejnilo ani nenasadilo. Kontrolór neupravoval aplikačný kód. **Grafická kontrolná etapa je ukončená.**

---

## Tretie kolo – kandidát CutYIWNT

**Aktuálny verdikt: RETURN WITH DEFECTS – otvorené iba F7.** Opravy F6 a F8 sú v skutočnom novom renderi prijaté. Pôvodný dlhý filter sa už zalomí a zmestí, ale výber/fokus iných filtrov ich môže nechať čiastočne skryté za okrajom vodorovného pásu. Nejde o falošný výsledok automatického testu: vada je viditeľná aj na nových vlastných screenshotoch.

- Presný kandidát: `tmp/review-layout/candidate-1793097973180`, BUILD_ID `CutYIWNT_m0fzhq1O1GCf`, lokálne http://127.0.0.1:3147/.
- Identita BUILD_ID bola priamo prečítaná z kandidáta. Prečítaný koreňový fingerprint `tmp/public-polish-final/candidate-source.json` uvádza 802 súborov a source SHA256 `ad37ddc44190a2e357afc35a7eff218468bd9b3032d0171907503f3f87d025ee`; kontrolór ho nepovažuje za náhradu vlastného renderu ani za vlastný druhý výpočet 802 hashov.
- Cielená vlastná regresia: **10 stránok × 1440/390/320 px = 30 renderov**: `/`, `/o-firme/`, obe hlavné služby, `/realizacie/`, `/strechari/`, `/recenzie/`, `/kariera/`, `/cookies/`, `/ochrana-osobnych-udajov/`. Všetky HTTP 200, bez JS chyby, po jednom H1 a bez dokumentového presahu. Dôkazy `recheck-03-final/acceptance.json`.
- Všetkých sedem galériových filtrov sa samostatne kliklo pri 390 a320 px; po 350 ms aj po 1 s sa meral text voči reálnemu orezávajúcemu rodičovi. Rovnakých sedem sa prešlo aj klávesom Tab. Dôkazy `recheck-03-final/all-filters.json` a samostatné snímky každého stavu.
- Sieť bola opäť obmedzená na loopback GET/HEAD; žiadny formulár, e-mail, zákaznícke údaje ani externý súhlas sa neodoslal. Aplikačný kód kontrolór nemenil.

### Uzavreté v tomto kole

- **F6 PASS:** homepage, O firme aj obe služby skutočne zobrazujú priamu vetu „Oprávnenia spoločnosti ASTANA, s.r.o. si môžete overiť v aktuálnom registri ÚVZ SR podľa IČO 46 157 701.“ O firme má pozitívnu kartu „Pozrite si naše demontáže na rôznych objektoch a v jednotlivých etapách práce.“ Pôvodný interný metatext sa v DOM týchto renderov nenašiel. Overené desktopom aj oboma mobilnými šírkami; napr. `390-home-lookup.png`, `320-o-firme-lookup.png`, `1440-o-firme-photocard.png`.
- **F8 PASS:** pri 390 px má `.roofer-b2b-inner` aj main šírku 362 px, pri 320 px obe 292 px. Riadok už nekončí v skrytom okraji: pri 390 px text končí na 349,64 px a main na 376 px; pri 320 px text na 288,06 px a main na 306 px. Formulárový rám je celý. Dôkazy `390-roofer-registration.png`, `320-roofer-registration.png` a geometria v acceptance.json.
- **Bez regresie F2/F3/F4/F5:** skutočný kariérny a strechársky popis zostáva čitateľný; recenzné CTA je zelené bez červeného tieňa, aj hover; súhlas kariéry zostáva v jednom textovom bloku; Cookies drží zjednotené úvodné odsadenie. Screenshoty pri všetkých troch šírkach sú v adresári tohto kola.
- Dlhšia finálna GDPR sekcia má na390/320 px normálne zalomené odseky, čitateľné H2 a medzery. Retenčná časť rozlišuje dopyt, zákazku, cookie voľbu a 12-mesačné údaje o návštevnosti. Toto je vizuálne prijatie textového rozloženia; nie právny posudok ani potvrdenie produkčného behu retenčnej údržby.
- Celoplošná 105-riadková matica a 79 jedinečných fotografických identít z druhého kola zostávajú predchádzajúcim dôkazom širšieho rozsahu. V tomto cielenom kole sa nevydávajú za novú opakovanú kontrolu všetkých URL.

### F7 – P2: čiastočne viditeľný filter zostane po výbere/fokuse orezaný

1. **390 px, Hospodárske budovy:** po kliknutí je `aria-pressed=true`, text končí na **392,984px**, vodorovný pás na **338px**. `scrollLeft=94` zostáva rovnaký po 350 ms aj po 1 s. Z názvu je viditeľné iba „Hospodárske…“. Screenshot `390-filter-2-settled.png` a `390-filter-2-after1s.png`.
2. **320 px, Rodinné domy:** aktívny text končí na **279,719px**, pás na **268px**, `scrollLeft=0` aj po 1 s. Screenshot `320-filter-1-settled.png` a `320-filter-1-after1s.png`.
3. Pri Tab prechode sa v390 px orežú fokusované Hospodárske budovy a posledný dlhý filter; v320 px Rodinné domy, Priemyselné objekty a Balenie a odvoz. Focus obrys existuje, ale názov môže zostať čiastočne alebo celý mimo viditeľnej časti pásu. Príslušné `*-keyboard-filter-*-clipped.png`.

**Príčina:** kontajner používa `scroll-snap-type:inline`, tlačidlá `scroll-snap-align:start`. Čiastočne viditeľné tlačidlo možno kliknúť alebo fokusovať bez toho, aby sa do pásu posunulo celé. Zmena max-width a white-space rieši šírku posledného názvu, nie výber či klávesnicový posun ostatných.

**Potrebná oprava:** pri skutočnom výbere a pri klávesnicovom fokuse dostať konkrétne tlačidlo celé do viditeľnej plochy kompatibilne so scroll snapom, napríklad explicitným posunom na jeho začiatok. Zachovať vertikálnu polohu a nepoužiť skrytie textu ako nápravu. Potom nový presný build a vlastný klik/Tab pre všetkých sedem filtrov pri 320/390 px. Neprijať iba posledný dlhý názov alebo vloženú diagnostickú CSS.

### Hranice finálneho prijatia

Stále ide o lokálny kandidát, nie produkciu alebo indexáciu. Súkromné tokenové stránky, reálna DB a zákaznícke recenzie, odosielanie formulárov/e-mailov, Gmail OAuth, fyzické zariadenie Safari, právne posúdenie a produkčný retenčný cron zostávajú mimo tohto vizuálneho dôkazu. Jediný známy otvorený vizuálny nález pre tento kandidát je F7.

---

## Druhé kolo – aktuálny stav pred finálnou zostavou

**Verdikt druhého kola: RETURN WITH DEFECTS.** F1–F5 sú opravené a nezávisle overené. F6 je opravené na službách, regiónoch a článkoch, ale má dva viditeľné zostatky. Navyše sa pri reálnom používaní našli F7 a F8. Autor oznámil zdrojové opravy; tie ešte nie sú dôkazom opraveného finálneho renderu.

- Kandidát: `tmp/review-layout/candidate-1793097215829`, BUILD_ID `A1N4rEMkS7fveB01k0CQ2`, http://127.0.0.1:3147/.
- Vlastný prechod dokončený 2026-10-27T10:55:57.592Z; 35 URL × 1440/390/320 px = **105 renderov**, všetky HTTP 200, po jednom H1, bez zachytenej JS chyby a bez horizontálneho presahu dokumentu. Tento posledný bod sám o sebe nevylučuje orezanie vnútorných prvkov, preto sú F7/F8 konkrétnymi screenshotovými nálezmi.
- Opäť boli vytvorené a vizuálne prezreté top/middle/bottom porovnávacie listy všetkých 35 URL pre 1440 aj 390 px, plné snímky a konkrétne originálne snímky chýb. Pri 320 px bol vykonaný samostatný render/merania a cielené screenshoty, nie druhá úplná séria plných snímok.
- Overené navyše Gmail info a pravá 404 na všetkých troch šírkach, mobilné menu, otvorenie FAQ, rozbalenie galérie na 30 kariet, všetky kategórie, lightbox a Escape. Žiadny formulár nebol odoslaný; iba loopback GET/HEAD, oba analytické/marketingové súhlasy denied.
- Dôkazy tohto kola sú samostatne v `tmp/gpt-public-visual-review/recheck-02/`; prvé kolo sa nižšie zachováva ako história.

### Uzavreté F1–F5 a prijatá časť F6

| Nález | Nezávislý výsledok |
| --- | --- |
| F1 fotografie | **PASS pre aktuálny statický verejný render.** Vlastný DOM všetkých 35 stránok plus skutočne rozbalená galéria poskytli **79 obsahových slotov / 79 identít / 0 opakovaní / 0 nenačítaných fotiek**. Počet vynecháva logo, skrytý lightbox aj responzívne deriváty. Nové úvody a 34 galériových výrezov boli vizuálne prezreté. SHA/pHash porovnanie zdrojov je samostatným dôkazom explorer agenta v docs/public-photo-inventory-2026-10-27.md; kontrolór ho nevydáva za vlastný výpočet. Nie je to tvrdenie o 79 rozdielnych zákazkách ani o budúcich DB fotografiách. |
| F2 kontrast | **PASS.** Kariéra má skutočné rgb(189,238,220) na pôvodnom tmavom gradiente: kontrast **9,51–11,53 : 1**. Strechársky horný popis má rgb(173,53,24) na rgb(244,248,250): **5,96 : 1**. Platí aj pre prezreté 390/320 px. |
| F3 CTA recenzie | **PASS.** Skutočné pozadie rgb(20,104,89), biely text **6,66 : 1**, box-shadow none. Hover zostáva zelený, focus má viditeľný modrý 3px obrys. Žiadny červený tieň pri 1440/390/320. |
| F4 kariérny súhlas | **PASS.** Celý súhlas vrátane odkazu a hviezdičky je jeden textový blok vedľa checkboxu. Pri 390 aj 320 sa veta číta po riadkoch; pôvodné samostatné pravé stĺpce zmizli. |
| F5 Cookies | **PASS.** Pri 390 px majú Cookies, GDPR aj Podmienky rovnaké padding 24px a H1 y=134,109 px. Prázdnych približne 120px navyše zmizlo. |
| F6 články/regióny/služby | Táto časť **PASS**. Články majú stručné „Z našej praxe“, autora a konkrétne zdroje. Regionálne úvody vysvetľujú výjazd z Popradu bez mätúcej výhrady o pobočke. Kde pôsobíme má vecný popis fotografie. Službový trust blok hovorí normálne o overení oprávnenia. Zostatky nižšie. |

### F6 – P2: zostávajúce interné formulácie na / a /o-firme/

Obe stránky stále viditeľne zobrazujú „Centrálny firemný zdroj ASTANA uvádza overenie…“ a „samostatný trvalý odkaz na jeden riadok nie je k dispozícii“. Na O firme je v karte navyše „bez vymyslených lokalít či výmer“. Tieto vety stále opisujú tvorbu/overovanie obsahu namiesto normálnej komunikácie zákazníkovi.

**Dôkaz:** `390-home-copy-remainder.png`, `390-o-firme-copy-remainder.png`, `copy-remainder.json`, `summary.json` v adresári druhého kola. Viditeľnosť je potvrdená display:block, visibility:visible a screenshotom; nejde o skrytý zdrojový text.

**Oprava:** priamo uviesť, kde si človek preverí oprávnenie ASTANA podľa IČO, a pozitívne opísať reálne fotografie. Zachovať datované zdrojové fakty v proveniencii; nepredstierať nové overenie úradu. Autor hlási opravu v zdroji cez publicLookupHint; finálny render zatiaľ **NEOVERENÝ**.

### F7 – P2: názov posledného filtra galérie sa oreže

**/realizacie/, 320 px**, po výbere „Strecha pripravená pre strechára“. Viditeľná plocha filtra je **216px**, tlačidlo **288,906px**, white-space:nowrap a flex:0 0 auto; kontajner je nowrap/overflow:auto. Po aktivácii zostane názov orezaný z oboch strán. Pri 390 px má plocha 286 px, tlačidlo je tiež mierne širšie. Dokument nemá horizontálny scroll, takže všeobecný zelený overflow test chybu nezachytil.

**Dôkaz/reprodukcia:** `320-gallery-filter-active.png`, `390-gallery-filter-active.png`, `gallery-filter-metrics.json`; otvoriť Realizácie, posunúť/vybrať poslednú kategóriu. Galéria aj lightbox fungujú, chyba je čitateľnosť ovládania.

**Oprava:** dlhému mobilnému filtru dovoliť riadky a obmedziť šírku na viditeľnú plochu, zachovať zmysluplný swipe a focus. Overiť prvý aj posledný filter, obidva okraje a klávesnicový focus. Autor hlási scoped zdrojovú opravu; skutočný finálny render zatiaľ **NEOVERENÝ**.

### F8 – P2: pravý okraj strechárskej registrácie je orezaný

**/strechari/, 390 px**, úvod registrácie pod nadpisom „Chcete, aby sme o vás vedeli…“: riadok s „…vhodnú zákazku pre“ má skutočný pravý okraj textu **379,094px**, ale main s overflow-x:hidden končí na **376px**. Posledné písmeno je čiastočne odrezané. .roofer-b2b-inner má366px pri šírke main/section362px. Pri320 px je rovnaký4px nesúlad296 vs292; na zvolenom riadku sa text náhodou zmestí, okraj formulára však zostáva orezaný.

**Dôkaz:** `390-roofer-text-edge.png`, `320-roofer-text-edge.png`, `roofer-text-edge.json`. Reprodukcia vyžaduje prejsť k registrácii po načítaní dolných štýlov; skoré meranie iba hraníc viewportu túto chybu nevylúči.

**Oprava:** mobilnému vnútornému wrapperu nastaviť rozmer v rámci reálneho rodiča, napr. scoped max-width:100%; neprekryť príčinu ďalším skrytím overflow. Finálny render zatiaľ **NEOVERENÝ**.

### Matica druhého kola

Všetky tri šírky sú skutočné nové načítania. „Prejdené“ nezakrýva vyššie uvedené otvorené vady.

| URL | 1440 px | 390 px | 320 px | Stav |
| --- | --- | --- | --- | --- |
| / | prejdené | prejdené | prejdené | F6: zostatok interného metatextu. |
| /likvidacia-azbestu/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-eternitu/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /cena-likvidacie-azbestu/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /postup/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /kde-posobime/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /faq/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /realizacie/ | prejdené | prejdené | prejdené | F7: dlhý mobilný filter; ostatná galéria prijatá. |
| /recenzie/ | prejdené | prejdené | prejdené | F3 opravené, zelené CTA a hviezdičky. |
| /o-firme/ | prejdené | prejdené | prejdené | F6: zostatok interného metatextu. |
| /kontakt/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /strechari/ | prejdené | prejdené | prejdené | F2 opravené; F8: pravý okraj registrácie. |
| /kariera/ | prejdené | prejdené | prejdené | F2/F4 opravené, čitateľný súhlas. |
| /spolupracujuci-strechari/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-poprad/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-kosice/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-presov/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-zilina/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-banska-bystrica/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-bratislava/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-nitra/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-trnava/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /likvidacia-azbestu-trencin/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/co-je-eternit-a-kedy-obsahuje-azbest/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/preco-neodstranovat-eternit-svojpomocne/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/kolko-stoji-likvidacia-azbestu/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/ake-doklady-dostanete-po-likvidacii-azbestu/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/ako-zmerat-strechu-pre-cenovu-ponuku/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/azbest-v-interieri-vs-exterieri/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /poradna/odvoz-a-balenie-azbestoveho-odpadu/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /ochrana-osobnych-udajov/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /cookies/ | prejdené | prejdené | prejdené | F5 opravené, zhodné úvodné odsadenie. |
| /podmienky-pouzivania/ | prejdené | prejdené | prejdené | Bez novej konkrétnej blokujúcej vady v prezretom renderi. |
| /prepojenie-gmailu/ | prejdené | prejdené | prejdené | HTTP 200, noindex, bez zistenej regresie rozloženia. |
| /kontrolor-neexistujuca-stranka/ | prejdené | prejdené | prejdené | Pravá404, noindex, čitateľná návratová navigácia. |

### Zostávajúce hranice prijatia

Toto stále nie je produkcia ani potvrdenie indexácie. Lokálny náhľad nemá produkčnú DB: reálne schválené recenzie, dlhé zákaznícke záznamy a dynamické referenčné fotografie nie sú overené. Súkromné tokenové obrazovky, admin, reálne odoslanie mailu/formulárov, Gmail OAuth, fyzický iPhone/Safari, reálne CWV a právne posúdenie nie sú týmto vizuálnym kolom prijaté. Backendová implementácia majiteľom určenej12-mesačnej retencie prebieha osobitne; tento report nepotvrdzuje jej produkčný beh ani aktuálnu nasadenú politiku.

Na finálne vizuálne prijatie stačí nový presný build a cielené preverenie F6/F7/F8 plus primeraná regresia dotknutých šablón; už preukázaná105-riadková matica sa nemusí bezdôvodne opakovať. Kontrolór nemodifikoval aplikačný kód a nič nenasadil.

---

## Prvé kolo – zachovaná história

**Verdikt prvého kola: RETURN WITH DEFECTS.** Technická priechodnosť je dobrá, ale aktuálny kandidát ešte nespĺňa všetky vizuálne a obsahové požiadavky. Nasadenie týmto reportom nie je schválené.

## Kandidát a nezávislosť

- Kontrola: 27. 10. 2026, vlastné dôkazy dokončené 2026-10-27T10:15:17.920Z.
- Lokálny kandidát: http://127.0.0.1:3147/, izolovaná zostava `tmp/review-layout/candidate-1793094831760`, build `mleluqZFvwg3YJ6pfzPXC`.
- Východiskový Git HEAD: `c4272342b8207ff27aafa9508af831c1fe56df09`; ide o pripravené lokálne zmeny nad touto produkčnou verziou.
- Prečítané pravidlá AGENTS.md, plán verejného obsahu a plán recenzií/typografie. Kontrolór neimplementoval hodnotené obrazovky a nemenil app/src.
- Autorove PASS výsledky neboli použité ako vizuálne prijatie. Kontrolór vytvoril vlastné prehliadačové záznamy, screenshoty a merania.
- Prejdených 35 sitemap URL pri 1440, 390 a 320 px (105 načítaní), plus Gmail informačná stránka a skutočná 404 pri tých istých šírkach (6 ďalších načítaní).
- Pri 1440 a 390 px sa každá stránka posunula po celej výške, aby sa načítali aj odložené fotografie a päta; uložený je celý náhľad aj začiatok/stred/koniec. Pri 320 px je vykonaný vlastný render a meranie; plná screenshotová sada sa pri tejto šírke neduplikovala.
- Pri vizuálnom posúdení boli prezreté porovnávacie listy všetkých 35 stránok, konkrétne vadné miesta aj vybrané originálne snímky. Vizuálny úsudok sa netvári ako meranie každého pixelu alebo garancia dokonalosti.
- Žiadny formulár nebol odoslaný. Prehliadač povoľoval iba GET/HEAD na loopback; analýza ani marketing neboli povolené.

## Nálezy vyžadujúce opravu

### F1 – P2: opakovanie rovnakých fotografií medzi podstránkami

**Požiadavka:** fotografie sa na stránke nemajú opakovať. Aktuálny render túto podmienku nespĺňa. Napríklad homepage a služba Eternit majú rovnakého pracovníka na rovnakej streche; služba Azbest a O firme rovnaký priemyselný objekt; fotografia drevenice sa opakuje v poradni, článku o výmere a regionálnom úvode Žiliny. Viaceré ďalšie zábery prechádzajú z galérie do úvodov článkov a regiónov.

**Dôkaz:** `sheet-desktop-top-1.png`, `sheet-desktop-top-2.png`, `sheet-desktop-top-3.png`, `sheet-mobile-top-1.png`, `sheet-mobile-top-4.png`, `sheet-mobile-top-5.png` v dôkazovom adresári. Toto je vizuálne potvrdenie opakovania, nie náhrada samostatného zdrojového inventára explorer agenta.

**Reprodukcia:** otvoriť uvedené dvojice/trojice stránok a porovnať hlavný záber. Zmena orezania alebo veľkosti z rovnakého záberu nerobí novú fotografiu.

**Oprava:** priradiť odlišné existujúce originálne fotografie ku každej verejnej obsahovej pozícii, vyriešiť aj obrázky v rozcestníkoch a galérii. Logá, ikony a responzívne varianty toho istého jediného zobrazenia nie sú duplicitné obsahové fotografie. Právne stránky nepotrebujú dekoratívny obrázok. Použiť reálne ASTANA podklady; nevymýšľať lokalitu, zákazníka ani prácu.

### F2 – P2: nedostatočný kontrast malých farebných nadpisov

1. **/kariera/**, tmavý panel „Čo je dôležité“: malý text má `rgb(8,120,184)`, 12 px na gradiente `rgb(16,40,74) → rgb(24,54,94)`. Kontrast je **2,54–3,08 : 1**, pod požadovaným 4,5 : 1. Na mobile aj desktope je popis príliš tmavý.
2. **/strechari/**, horný oranžový popis „Partner pre strechárov po celom Slovensku“: `rgb(211,74,34)` na `rgb(244,248,250)`, 13 px. Kontrast **4,12 : 1**, tiež pod 4,5 : 1.

**Dôkaz:** `1440-kariera-top.png`, `390-kariera-top.png`, `1440-strechari-top.png`, `390-strechari-top.png`, `inspect-palette.mjs`, `contrast-check.json`.

**Oprava:** v tmavom kariérnom paneli použiť svetlú tyrkysovú/bielu a na svetlom strechárskom úvode tmavší oranžový odtieň. Opravu urobiť scoped; všeobecná trieda `.eyebrow` dnes prebíja zámer lokálnych komponentov. Skontrolovať skutočné computed farby po zostavení.

### F3 – P2: tlačidlo recenzie nerešpektuje schválený farebný návrh

**/recenzie/**: „Odoslať skúsenosť“ je v skutočnom renderi červené s červeným tieňom, hoci plán a lokálna definícia požadujú zelenú v mätovom paneli. Computed background je `rgb(218,37,29)` a tieň `rgba(218,37,29,.22)`. Nejde o nečitateľný text, ale o prebitý lokálny dizajn a rozpor s predloženým výsledkom.

**Dôkaz:** `1440-recenzie-middle.png`, `inspect-palette.mjs`.

**Oprava:** scoped štýl recenzného tlačidla musí prekryť globálne pozadie/gradient a červený tieň, aj hover. Znovu prezrieť 1440/390/320 px. Nemeniť odosielaciu logiku.

### F4 – P2: GDPR súhlas kariérnej žiadosti sa rozpadá do slovných stĺpcov

**/kariera/** pri **390 a 320 px**: text súhlasu sa vizuálne delí na samostatný hlavný stĺpec a úzky pravý stĺpec s odkazom „ochrany / osobných / údajov“. Bodka a hviezdička tvoria ďalší kus. Veta sa nedá normálne čítať po riadkoch. Samotná kontrola horizontálneho scrollu tento problém nezachytí.

**Dôkaz:** `390-career-consent.png`, `320-career-consent.png`, `consent-check.json`. Zdrojová príčina je pri `app/career-form-client.tsx:236`: flex label obsahuje checkbox, anonymný text, anchor a ďalší textový uzol.

**Reprodukcia:** otvoriť kariérnu žiadosť na 390/320 px a prejsť k poslednému súhlasu pod životopisom.

**Oprava:** celý text vrátane odkazu, bodky a hviezdičky obaliť jedným spanom, aby label mal len checkbox a jeden textový flex prvok. Znenie súhlasu, názov poľa, required a spracovanie zachovať.

### F5 – P2: nesúrodý a prázdny začiatok stránky Cookies

**/cookies/** pri 390 px má H1 na y=254,5 px a eyebrow na y=211 px; Podmienky aj GDPR majú H1 na y=134,1 px a eyebrow na y=97 px. Cookies tak začínajú približne o **120 px nižšie**, bez obsahového dôvodu. Na malom displeji to pôsobí ako vynechaná sekcia.

**Dôkaz:** `390-cookies-top.png`, `sheet-mobile-top-6.png`, `legal-spacing.json`.

**Oprava:** zjednotiť horné odsadenie tejto informačnej stránky s ostatnými. Ide iba o rozloženie; cookie voľbu ani súhlasy nemeniť.

### F6 – P2: na niektorých miestach zostal interný a defenzívny metatext

- V bloku dôveryhodnosti služieb a O firme sa zobrazuje „Centrálny firemný zdroj ASTANA uvádza overenie…“ a technická poznámka o tom, že nie je dostupný trvalý odkaz na riadok registra. Znie to ako interný audit, nie informácia pre zákazníka.
- Poprad začína tvrdením o sídle v Poprade a končí „v tejto lokalite nemáme pobočku“. Nemusí ísť o právnu nepravdu, ale v sídelnom meste je to zbytočne mätúce. Aj ostatné regionálne úvody pôsobia kvôli rovnakej výhrade šablónovito.
- Článková karta „Praktická metodika ASTANA“ s vetou „Neodvoláva sa na externý cenník ani normu“ a opakovaný odsek o tom, ktoré druhy tvrdení podporujú zdroje, opisujú internú tvorbu článku namiesto toho, aby pomohli čitateľovi.
- Pod obrázkom na Kde pôsobíme zostáva poznámka „Regionálne stránky označujú pôsobnosť, nie sieť pobočiek“. Je vhodnejšia stručná pozitívna informácia o výjazdoch z Popradu v hlavnom texte, nie obhajoba regionálnych stránok v popisku fotografie.

**Dôkaz:** `1440-likvidacia-azbestu-middle.png`, `sheet-mobile-middle-1.png`, `sheet-mobile-top-3.png`, `sheet-mobile-middle-5.png`, `390-kde-posobime-top.png`.

**Oprava:** jednoduchý zákaznícky jazyk: pravdivo uviesť sídlo, oprávnenie a odkaz na register; regiónom vysvetliť výjazd; článkom nechať stručnú informáciu o tíme/aktualizácii a reálne zdroje. Nepridávať nové tvrdenia, pobočky, ceny či zdravotné závery. Praktické jadro článkov je už užitočné a netreba ho nahrádzať ďalším všeobecným textom.

## Čo bolo priamo overené ako dobré

- Všetkých 35 stránok sa načítalo HTTP 200 pri troch šírkach, bez zachytenej JavaScript chyby a bez horizontálneho presahu dokumentu.
- Dodatočne boli zmerané reálne hranice textových riadkov na všetkých 35 URL pri 390/320 px; **0 textov mimo viewportu**. To je samostatná kontrola popri uvedenom kariérnom probléme vnútornej skladby vety.
- Pozorované H1, odseky a karty majú čitateľnú hierarchiu. Farebnosť väčšiny stránok tvorí zmysluplná kombinácia tmavomodrej, červenej CTA, mätových súvisiacich odkazov a teplých kontrolných zoznamov.
- Dlhé články majú vlastné praktické otázky, modelové príklady bez vymyslených cien, obsahovú osnovu a interné odkazy. Nemajú už dojem troch odsekov do počtu.
- Regionálne praktické bloky sa venujú odlišným situáciám a sú užitočnejšie než samotné prepisovanie názvu mesta. Úvodný metatext však potrebuje F6.
- Recenzný formulár je pred fotografiou a skúsenosťami; hviezdičky sú jasné a panel je príjemný. Podoba odosielacieho tlačidla potrebuje F3.
- Fotografie v prezretých snímkach nie sú rozbité a po posune stránky sa načítava aj pätičkové logo. Duplicitnosť je samostatná chyba F1.
- Mobilné menu sa otvorilo, malo 10 viditeľných odkazov a správne zmenilo aria-expanded. FAQ sa otvorilo a odpoveď bola čitateľná. Neodosielali sa žiadne formuláre.
- Informačná stránka Gmailu je čitateľná a noindex; neexistujúca cesta vrátila skutočnú 404 s navigáciou a noindex.

## Matica prejdených URL

„Prejdené“ znamená vlastné načítanie/posunutie/render a prezretie screenshotových dôkazov, **nie vyhlásenie celej stránky za prijatú napriek nálezom**. Globálny F1 vyžaduje samostatné vyriešenie fotografie aj na stránkach, ktorých rozloženie je v poriadku.

| URL | 1440 px | 390 px | 320 px | Poznámka |
| --- | --- | --- | --- | --- |
| / | prejdené | prejdené | prejdené | Bez ďalšej konkrétnej vady rozloženia; fotografie podliehajú F1. |
| /likvidacia-azbestu/ | prejdené | prejdené | prejdené | F1, F6; úvod a stĺpce čitateľné. |
| /likvidacia-eternitu/ | prejdené | prejdené | prejdené | F1, F6; úvod a stĺpce čitateľné. |
| /cena-likvidacie-azbestu/ | prejdené | prejdené | prejdené | Bez ďalšej konkrétnej vady rozloženia; fotografie podliehajú F1. |
| /postup/ | prejdené | prejdené | prejdené | Bez ďalšej konkrétnej vady rozloženia; fotografie podliehajú F1. |
| /kde-posobime/ | prejdené | prejdené | prejdené | F1, F6; prehľad regiónov je zrozumiteľný. |
| /faq/ | prejdené | prejdené | prejdené | Bez ďalšej konkrétnej vady rozloženia; fotografie podliehajú F1. |
| /realizacie/ | prejdené | prejdené | prejdené | Bez ďalšej konkrétnej vady rozloženia; fotografie podliehajú F1. |
| /recenzie/ | prejdené | prejdené | prejdené | F1, F3; dotazník prvý, hviezdičky prehľadné. |
| /o-firme/ | prejdené | prejdené | prejdené | F1, F6; kontaktné a obsahové karty prehľadné. |
| /kontakt/ | prejdené | prejdené | prejdené | Bez ďalšej konkrétnej vady rozloženia; fotografie podliehajú F1. |
| /poradna/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /strechari/ | prejdené | prejdené | prejdené | F2; inak funkčná hierarchia a mobilné usporiadanie. |
| /kariera/ | prejdené | prejdené | prejdené | F2, F4; kariérna karta a žiadosť inak prehľadné. |
| /spolupracujuci-strechari/ | prejdené | prejdené | prejdené | Bez ďalšej konkrétnej vady rozloženia; fotografie podliehajú F1. |
| /likvidacia-azbestu-poprad/ | prejdené | prejdené | prejdené | F1, F6; vlastný praktický blok a checklist. |
| /likvidacia-azbestu-kosice/ | prejdené | prejdené | prejdené | F1, F6; praktický regionálny obsah čitateľný. |
| /likvidacia-azbestu-presov/ | prejdené | prejdené | prejdené | F1, F6; praktický regionálny obsah čitateľný. |
| /likvidacia-azbestu-zilina/ | prejdené | prejdené | prejdené | F1, F6; praktický regionálny obsah čitateľný. |
| /likvidacia-azbestu-banska-bystrica/ | prejdené | prejdené | prejdené | F1, F6; praktický regionálny obsah čitateľný. |
| /likvidacia-azbestu-bratislava/ | prejdené | prejdené | prejdené | F1, F6; praktický regionálny obsah čitateľný. |
| /likvidacia-azbestu-nitra/ | prejdené | prejdené | prejdené | F1, F6; praktický regionálny obsah čitateľný. |
| /likvidacia-azbestu-trnava/ | prejdené | prejdené | prejdené | F1, F6; praktický regionálny obsah čitateľný. |
| /likvidacia-azbestu-trencin/ | prejdené | prejdené | prejdené | F1, F6; praktický regionálny obsah čitateľný. |
| /poradna/co-je-eternit-a-kedy-obsahuje-azbest/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /poradna/preco-neodstranovat-eternit-svojpomocne/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /poradna/kolko-stoji-likvidacia-azbestu/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /poradna/ake-doklady-dostanete-po-likvidacii-azbestu/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /poradna/ako-zmerat-strechu-pre-cenovu-ponuku/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /poradna/azbest-v-interieri-vs-exterieri/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /poradna/odvoz-a-balenie-azbestoveho-odpadu/ | prejdené | prejdené | prejdené | F1, F6; praktické jadro článku a osnova sú čitateľné. |
| /ochrana-osobnych-udajov/ | prejdené | prejdené | prejdené | Informačná stránka; bez potreby dekoratívnej fotografie. |
| /cookies/ | prejdené | prejdené | prejdené | F5; obsah čitateľný, zbytočne posunutý začiatok. |
| /podmienky-pouzivania/ | prejdené | prejdené | prejdené | Informačná stránka; bez potreby dekoratívnej fotografie. |
| /prepojenie-gmailu/ | prejdené | prejdené | prejdené | Čitateľné informácie, HTTP 200, noindex. |
| /kontrolor-neexistujuca-stranka/ | prejdené | prejdené | prejdené | Správna 404, návratová navigácia, noindex. |

## Hranice a neoverené časti

- Toto je **lokálny kandidát**, nie kontrola aktuálnej produkcie, nasadenia alebo indexácie Google.
- Recenzie a databázové prípadové štúdie sa zobrazovali bez produkčnej databázy. Reálne publikované recenzie, dlhé mená/texty konkrétnych záznamov a mapové prípadové dáta preto nie sú týmto reportom prijaté. Neboli vymýšľané referencie na zaplnenie prázdneho stavu.
- Súkromné stránky s tokenmi sa bez skutočných zákazníckych tokenov neotvárali. Administrácia a jej oprávnenia nie sú súčasťou tohto grafického auditu.
- Nevyskúšalo sa reálne odoslanie dopytu, cenovej ponuky, e-mailu, recenzie ani externý Gmail OAuth. Nečítali sa produkčné tajomstvá ani súkromné súbory zákazníkov.
- Nevykonalo sa meranie reálnych Core Web Vitals/Lighthouse ani test na fyzickom iPhone/Safari. Render používal lokálny Chromium/Edge na Windows; viewport 320 px nie je dôkaz fyzického zariadenia.
- Právne/zdravotné tvrdenia a aktuálny register sa v tomto vizuálnom kole neoverovali proti živým externým zdrojom. Nález F6 požaduje prirodzenejšie znenie pri zachovaní faktov, nie nové právne závery.

## Podmienka ďalšieho prijatia

Autor opraví F1–F6, zostaví jednoznačný nový kandidát a pošle jeho identitu. Kontrolór potom nezávisle otvorí opravené miesta, prezrie nové fotografie vo všetkých dotknutých šablónach a preverí, že opravy nerozbili mobilné rozloženie ani zákaznícku orientáciu. Až skutočné dôkazy bez otvorených blokujúcich vád môžu zmeniť verdikt na PASS. Repozitárový build alebo vyjadrenie autora samostatne nestačí.

## Dôkazy

Všetko pod `tmp/gpt-public-visual-review/`: `audit.json` (105 záznamov), `extra-flow.json`, `text-bounds.json`, plné screenshoty `1440/390-*-full.png`, zábery top/middle/bottom, porovnávacie listy `sheet-desktop-*` a `sheet-mobile-*`, konkrétne nálezy kontrastu/súhlasu/odstupov. Hodnotený aplikačný kód kontrolór neupravoval.
