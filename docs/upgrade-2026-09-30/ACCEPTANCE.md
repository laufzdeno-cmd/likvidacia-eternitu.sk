# Akceptácia: meranie, testy a ochrana produkcie

Súčasť [plánu](PLAN.md). Verzia metodiky1.0 sa uzamkne prijatím E0. Nezávislý GPT kontrolór hodnotí dôkazy, nie vlastný dojem. Cieľové skóre nie je dnešná známka ani predikcia predaja.

## 1. Zásady a závažnosť

- PASS iba s odkazom na dôkaz, dátumom, commitom/deploymentom a prostredím. Implementované ≠ testované ≠ nasadené ≠ doručené do inboxu.
- FAIL = reprodukovaný nesplnený test. NOT_TESTED/WAITING = chýbajúce overenie, nikdy automaticky PASS.
- P0: strata alebo únik údajov, závažné neautorizované odoslanie či prístup. P1: nefunkčný hlavný tok, nesprávna cena, nedostupné zásadné ovládanie, pravdepodobná strata dopytu/príloh. P2: nekritická funkčná/SEO/UX chyba. P3: drobná redakčná alebo kozmetická chyba.
- Finálny release E8 bez P0/P1. Dielčí ochranný release smie riešiť jednu existujúcu vadu s nezávisle prijatým diffom a regresiou, bez nového P0/P1; nesúvisiace existujúce vady ostanú uvedené, celok nie je hotový. Nulový počet chýb v konzole nenahrádza funkčný test.
- Obchodná a vizuálna kvalita má finálnu bránu **100 % povinných kontrol**: všetky relevantné obchodné scenáre, formuláre, cenová cesta, administrácia, responzívne viewporty, zoom, klávesnica, kontrast a podporované prehliadače musia prejsť. Ak zostáva známa chyba P0–P3, chýbajúci povinný test alebo nevyriešený vizuálny nález, projekt sa neoznačí za hotový. Ide o 100 % preukázaného checklistu, nie neoveriteľné tvrdenie o absolútnej dokonalosti.
- Všetky skórovacie bunky sú binárne: splnené všetky podmienky = plný počet, inak0. Žiadne svojvoľné polbody. Pri chýbajúcom prístupe zostáva pevný menovateľ a explicitná medzera.

## 2. SEO scorecard – 100 bodov, cieľ ≥90

Každý riadok10 bodov. Rozsah = všetky verejné indexovateľné URL finálnej sitemap a relevantné chybové/presmerované URL.

| ID | PASS vyžaduje |
|---|---|
| S01 | Crawl všetkých URL: správny200/301/404, HTTPS/host jednotné, žiadne slučky/broken interné odkazy |
| S02 | Presné canonical a index/noindex, jednoznačné404; žiadne vyradenie obchodnej URL omylom |
| S03 | Unikátne vecne správne title/description, jedno H1 a zrozumiteľná hierarchia na každej obsahovej URL |
| S04 | Syntakticky validné pravdivé JSON-LD bez dup BreadcrumbList, entita so stabilným ID, schema zodpovedá viditeľnému obsahu |
| S05 | Sitemap iba kanonické verejné stránky, lastmod pravdivý alebo vynechaný, robots skupiny konzistentné a bez nechcenej blokácie |
| S06 | Účel a obsah odlišný pre službu/cenu/región/článok, žiadne hromadné klony ani vymyslené miestne dôkazy |
| S07 | SSR obsah a interné odkazy dostupné bez interakcie, každý prípad prepojený so službou/regiónom, žiadne orphan obchodné URL |
| S08 | Vzorka výkonu homepage/cena/realizácie/článok/kariéra: medián3 mobilných behov Lighthouse Performance≥90, labLCP≤2,5s, CLS≤0,1, bez kritických blokátorov; rovnaký profil a prostredie |
| S09 | GSC/Bing vlastníctvo a stav odoslanej sitemap/indexácie overený v dostupnom účte, baseline28/90d s dátumami; obmedzenia reportu zapísané |
| S10 | Optimalizované vlastné médiá: rozmery, alt podľa významu, responsive varianty, hero bez nevhodného lazy load, fonty bez zbytočného blokovania; bez neodsúhlasených osobných údajov |

Lighthouse100 zostáva stretch cieľ, nie záruka. Field CWV75.percentil LCP≤2,5s/INP≤200ms/CLS≤0,1 kontrolovať z CrUX/GSC, ak je dostatočná vzorka; inak NOT_ENOUGH_DATA. Lab výsledok sa nesmie volať fieldINP PASS. Dostupnosť field dát nemôžeme vynútiť nasadením; reportujeme ju oddelene od launchscore.

## 3. GEO pripravenosť – 100 bodov, cieľ ≥90

Toto meria kvalitu a overiteľnosť našich podkladov, nie pravdepodobnosť odporúčania konkrétnym modelom. Kritériá G01–G10 majú každé10 bodov (spolu100). G11 je samostatná povinná publikačná hardgate bez bodovej váhy: každá realizácia musí spĺňať požiadavky na práva, približnú lokalitu, pôvod a audit pred zverejnením; nesplnenie blokuje E8 bez ohľadu na skóre.

| ID | PASS vyžaduje |
|---|---|
| G01 | Jednotná právna identita, kontakt, sídlo a história vo viditeľnom texte/JSON-LD/company JSON; žiadny verejný TODO |
| G02 | Každá hlavná služba odpovedá priamo komu/čo/kde, jasne oddeľuje rozsah služby a výnimky |
| G03 | Cena má potvrdené predpoklady, DPH, zahrnuté/vylúčené položky a odlíšenie orientačného odhadu od schválenej ponuky |
| G04 | Minimálne5 doložených, odlíšených prípadov so skutočnými fotografiami a odsúhlaseným verejným rozsahom údajov; žiadne fiktívne lokality |
| G05 | Aktuálne overený rozsah oprávnenia, skutočný autor/garant podľa typu obsahu, zdroje a dátum vecnej revízie právnych/tvrdených faktov |
| G06 | Všetkých8 krajov má pravdivo vysvetlenú obsluhu; existujúce regionálne URL majú užitočnú vlastnú hodnotu; pôsobnosť nie je vydávaná za pobočku alebo realizáciu |
| G07 | Rozhodovacie FAQ poskytuje priame konzistentné odpovede a súvisiace odkazy; bezpečnostné tvrdenia bez svojpomocných rizikových návodov |
| G08 | Konzistentné verejné profily v dostupných firemných účtoch a dohľadateľné reálne recenzie; bez vyrobených citácií a vlastných ratingov |
| G09 | Crawl dostupnosť OAI-SearchBot a relevantných vyhľadávačov overená vrátane dostupných firewall/log dôkazov; GSC generatívne nastavenie zaznamenané, neznáme ostáva neznáme |
| G10 | Reprodukovaný24otázkový panel minimálne v dostupnom GPT a aspoň jednom ďalšom vyhľadávacom systéme, presné odpovede/citácie archivované a faktické chyby zapísané; bez podsúvania firmy |
| G11 (hardgate) | Každá nová publikovaná realizácia má evidované admin potvrdenie práv k fotkám, kontroly približnej lokality, interného zdroja, schvaľovateľa a času; tieto polia sa nikdy neposielajú do verejného výstupu; existujúce záznamy prejdú manuálnou kontrolou pôvodu pred redakčnou aktualizáciou |

G10 vyžaduje poctivo vykonaný panel, nie minimálny počet pochvál. Neprítomnosť ASTANY v odpovedi je výsledok na ďalšie sledovanie, nie dôvod zmeniť otázku tak, aby ju model povedal. Ak druhý systém nie je dostupný, G10=0/NOT_TESTED.

## 4. Funkčnosť, UX a prevádzka

Funkčnosť F = percento úspešných povinných testov F01–F14 (každý rovnaká váha). Kritický test má aj hardgate, takže ho nevykompenzujú body inde.

| ID | Povinná skúška / očakávanie |
|---|---|
| F01 | Kalkulačka homepage aj cena pri priamom vstupe a pred/po scroll: všetky materiály, min/max/default, text/cena/aktívny stav súhlasia so schváleným modelom |
| F02 | Kalkulačka → formulár zachová obec/výmeru/materiál, nemení súhlas ani kontakty; bez kalkulácie funguje samostatný dopyt |
| F03 | Dopyt bez prílohy: jeden označený test, presne1 trvalý záznam, správne polia a atribúcia, jasný prijatý stav |
| F04 | Dve platné fotografie >6MB každá cez browser: prenos do private storage, správna väzba na ten istý dopyt, autorizované otvorenie a obsah/hash; zbytočné kopírovanie cez malý requestlimit neprípustné |
| F05 | Prílohy: maximálny počet/veľkosť podľa kontraktu, nepodporovaný typ, prázdny súbor, poškodený obraz, veľké pixelové rozmery; zrozumiteľná chyba bez straty ostatných údajov |
| F06 | Dvojklik, HTTP timeout a opakovanie s rovnakým submissionId pri známom mailovom výsledku: najviac1 záznam/1 interná notifikácia/1 zákaznícke potvrdenie. Iný legitímny dopyt nie je chybne potlačený. Neistý SMTP výsledok testuje F09, nie garancia exactly-once cez SMTP |
| F07 | Prerušený upload/submission: obnoviteľný formulár, žiadny falošný zelený úspech; následný retry nesmie priradiť cudzie alebo stratené prílohy |
| F08 | Interný email aj potvrdenie pri emailkontakte: skutočný inbox, správny odosielateľ/príjemca/predmet, údaje a prílohy či autorizované odkazy. SMTP/API prijatie samo nestačí |
| F09 | Izolované SMTP scenáre: preukázaná chyba pred prijatím → uložený dopyt + bezpečný retry; timeout po možnom prijatí → stav unknown, žiadny automatický alternatívny transport, preverenie logu/providerID/inboxu pred rozhodnutím. Admin môže stav uzavrieť iba po CSRF/autorizácii, výslovnom potvrdení kontroly a stručnom dôkaze bez obsahu emailu/PII; zápis výsledku a audit musia byť atomické. Potvrdené doručenie sa nikdy neposiela znova; potvrdené nedoručenie povoľuje len samostatný výslovný admin retry konkrétneho príjemcu. Kariérne aj strechárske emaily majú samostatný claim, výsledok a message ID pre každého príjemcu. Každý opakovaný pokus musí mať vlastný audit a zachovať unknown pri ďalšom nejednoznačnom výsledku. Ak dôkaz chýba, unknown zostáva nevyriešené. Produkčný SMTP úmyselne nevypínať |
| F10 | Admin/autorizácia: prílohu bez prístupu nemožno stiahnuť; cudzie uploadID/blob nemožno prevziať; žiadne kontakty/presné GPS v publicAPI/analytike/logoch |
| F11 | Starý klient otvorený pred release + nový backend a spätná kompatibilita: dopyt buď bezpečne prijme alebo vysvetlí obnovu, nikdy potichu zahodí fotografie |
| F12 | Kariéra a partneri: validácia a súkromné CV podľa kontraktu; po úspešnom strechárskom podaní má ďalšia žiadosť nové ID; chyba e-mailu sa nesmie tváriť ako doručenie a musí byť dohľadateľná/obnoviteľná; opakovaná kariérna žiadosť bezpečne dokončí alebo vysvetlí chýbajúce CV/e-mail bez duplicity; rate limit je zdieľaný medzi inštanciami alebo má zdokumentovanú rovnocennú ochranu. TEST nekontaktovať, bez automatickej ponuky |
| F13 | Mobilná galéria: všetky pomery snímok, filtre, otvorenie/zatvorenie, Escape/focus/scroll; žiadny nedostupný ovládač |
| F14 | Navigácia/CTA vrátane ukážok reálnych striech, telefónu, kariéry, kotiev, cookie voľby a mapy s fallbackom. Žiadna cenová ponuka bez schválenia adminom |

F03/F04/F06/F08/F10/F11 sú release hardgates. Ak sa v danom balíku mení len text/SEO, rozsah regresie môže byť menší, ale finálna E8 vyžaduje celý súbor. Očakávania kontaktových variantov sa musia presne zhodovať so schváleným backend kontraktom, nie poslať email bez emailadresy.

Ďalšie dátové hardgates E1A/B: inicializácia nemení deleted_at existujúcich obchodných fixtures; čítanie CMS nemení uložený admin obsah; výpadok uprostred prijatia nezanechá čiastkový lead/job/file stav; súbežný request používa unikátnosťDB a jedno transakčné spojenie; rovnaký submissionId s iným payloadom neprepíše prvý dopyt; cron sent:false nesmie nastaviť sent; unknownSMTP má odlišnú obnovu od preukázaného zlyhania. Skúšať iba izolovanou DB a mock transportom, nie naschvál poškodzovať produkciu.

UX score U: 10 binárnych buniek po10 bodov: (U01) bez overflow všetkých breakpointov; (U02) jeden jasný prvotný cieľ; (U03) prvé3 údaje a jasný ďalší krok; (U04) konzistentný vizuálny systém; (U05) WCAGAA kontrast a fokus; (U06) klávesnica a dialog; (U07) plávajúce prvky nič nezakrývajú; (U08) 200%zoom/landscape/reducedmotion; (U09) formulár chyby/loading/success sú čitateľné aj čítačkou; (U10) aspoň4 z5 skutočných skúšajúcich nájdu cenu alebo odoslanie kontaktu do60s bez pomoci. U10 bez ľudí =0/NOT_TESTED, modely nesmú predstierať ľudských testerov.

Prevádzkové score O: 10 buniek po10 bodov: (O01) čistý reprodukovateľný build; (O02) unit/integration výsledky; (O03) nezávislá kontrola immutable diff; (O04) preview a produkčný deployment evidence; (O05) rollback bez straty nových dát; (O06) delivery monitoring/retry vlastníctvo; (O07) súhlasy a eventpayload bezPII; (O08) dashboard kvalitné dopyty→zákazky, testy vylúčené; (O09) publikačný/retention workflow; (O10) zrozumiteľné odovzdanie s otvorenými bodmi a vlastníkom.

Celkové skóre = `0,25*S + 0,25*G + 0,25*F + 0,15*U + 0,10*O`, cieľ≥85. Samostatne S≥90 a G≥90, F všetky povinné skúšky PASS pri konečnej E8 a žiadnyP0/P1. Bodový výsledok neprebije hardgate. Percentá zaokrúhliť až na konci na1desatinné miesto.

## 5. Prostredia, matica a vykonávanie

- Breakpointy320/360/390/768/1024/1440, desktopChrome/Edge aleboOperaChromium, reálny Safari/iOS a AndroidChrome ak dostupné. Emulovaný viewport sa neoznačí ako test skutočného iPhonu. Nedostupný runtime zostáva NOT_TESTED.
- Každá šablóna: homepage, služba, cena, región, článok, prípad, kontakt, kariéra, adminDetail. Shared zmena vyžaduje vzorku všetkých konzumentov.
- Unit/integration: kalkulačné kľúče a hranice, serializer súkromia, idempotencia, validation, uploadbinding, deliveryretry, SEO schema a metadáta.
- Browser skúšky: priame URL, pomalšia sieť, cache aj studený vstup, back/forward, starýtab po release; žiadna závislosť fungovania kalkulačky od scrollu ku galérii.
- End-to-end testy majú unikátny identifikátor `TEST-UPGRADE-YYYYMMDD-...`, kontakty patriace firme/majiteľovi, poznámku „TEST – NEKONTAKTOVAŤ, NEPOSIELAŤ PONUKU“. Žiadne cudzie vymyslené telefónne čísla, žiadne reálne obchodné ponuky.
- Použiť platné fotografie, nie náhodné bajty s JPG hlavičkou. Verejné testovacie obrázky nesmú obsahovať údaje zákazníkov. Zdokumentovať prípadnú kompresiu, nie mylne porovnávať hash originálu s derivátom.
- Produkčné testy sú v rámci už požadovaného overenia; nevyužívať ich na hromadné emaily alebo test záťažou. Prístup a chýbajúci údaj riešiť iba v dotknutej etape.

## 6. AI panel a obchodné výsledky

Pre každý kraj BA/TT/TN/NR/ZA/BB/PO/KE položiť rovnaké3 otázky s príslušným názvom kraja:

1. „Hľadám firmu na odstránenie eternitovej strechy v [kraj]. Koho by ste odporučili a podľa čoho si mám vybrať?“
2. „Kto mi v [kraj] zabezpečí demontáž azbestovej strechy, odvoz a potrebné doklady?“
3. „Ako si v [kraj] vybrať spoľahlivú firmu na likvidáciu azbestu a overiť jej oprávnenie?“

Nové relácie bez histórie firmy. Záznam: poskytovateľ/model/režim/vyhľadávanie, dátum/čas, otázka, úplná odpoveď v súkromnom dôkazovom balíku, zmienka/citácia ASTANY, citovanáURL, konkurenti a faktické chyby. Verejne zhrnúť výsledky bez nadmerného kopírovania cudzích zdrojov. Report pomer zmienok/citácií/odporúčaní s menovateľom; nespojiť GPT a Google dáta do falošnej univerzálnej pozície.

Pred/po28d a90d: GSC kliky/zobrazenia/dotazy/zariadenie, počty kvalitných dopytov, technické chyby, ponuky, objednávky, tržby a príspevok na zisk. Obchodné zlepšenie je samostatná postrelease validácia, nie automatický dôsledok skóre. Bez dát o nákladoch nemožno tvrdiť ziskovosť. Bez dostatočnej vzorky nevyhlasovať víťaza A/B testu.

## 7. Review a release protokol

Každý balík: autor, rozsah/súbory, testy, nemenené citlivé oblasti, commit, previewURL, známe limity. Kontrolór: `APPROVE` alebo `RETURN_WITH_DEFECTS` s ID, závažnosťou a dôkazom. Najviac2 cielené opravné kolá, potom eskalácia konkrétneho blokera a iný nezávislý úsek; neschválený balík sa nepresadí len pre uplynutie času.

Pred produkciou overiť aktuálny alias a zmeny od baseline. Čistý balík bez lokálnych snapshotov/sekretov → build/test → READY preview → funkcie/visual/SEO → kontrolór. Preview kandidáta nie je automaticky ten istý produkčný runtime: Vercel pri povýšení Preview na Production vytvorí nový build s produkčnými premennými. Prednostný postup preto je vytvoriť **staged Production deployment** z prijatého SHA pri vypnutom automatickom priradení domény, overiť jeho build a bezpečné read-only správanie, a až potom priradiť doménu tomuto presnému staged deploymentu bez nového buildu. Ak projekt staged Production deployment nepodporuje, release sa zastaví na samostatnom rozhodnutí; Preview sa nesmie označiť za totožný artefakt. Pred mutačným testom staged deploymentu musí byť preukázaná izolácia DB/Blob. Po pridelení domény vykonať smoke na vlastnej doméne. Zaznamenať SHA, manifest, starý/nový deployment, build prostredie a diffs. Referencia: [Vercel — Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment) a [Vercel — Preview to Production](https://vercel.com/docs/deployments/promote-preview-to-production).

Rollback pri poškodení dopytov, súkromia, CTA či indexácie. Obnovovať predchádzajúci kompatibilný frontend/runtime, nie starú databázu cez nové živé dopyty. Migrácie vyžadujú bezpečný forward/backward plán a obnoviteľnú zálohu. Koniec projektu: prijatéE0–E8, splnené skóre/hardgates a dokumentovaný skutočný stav, nie iba dokončený plán.
