# Reálne fotografie, prípadové štúdie a mapa

## Cieľ a vstupy

Preukázať vlastnú prácu ASTANY bez zverejnenia zákazníckych príloh alebo presnej polohy domu. 179 terajších webových JPG nemá GPS ani bežné dátumové EXIF polia. Potrebujeme originálne fotografie v priečinku a/alebo majiteľom potvrdené obce. Chýbajúce GPS je normálny stav; nesmie blokovať prípad s dôveryhodne potvrdenou lokalitou.

Výber prvých5 prípadov má ukázať rôzne problémy: rodinný dom, hospodársky objekt, už zložený materiál, iný typ krytiny a koordináciu so strechárom – iba ak také práce máme doložené. Žiadna povinnosť vymyslieť chýbajúci typ alebo región.

## Tok spracovania

1. **Dočasný súkromný príjem od tímu:** pracovník dostane jednorazový náhodný kód, vymení ho za časovo obmedzenú reláciu a môže nahrávať iba vlastné fotografie. Kód je v DB uložený ako hash; upload token sa viaže na konkrétnu rezerváciu/objekt. Pozvánka má interné označenie pracovníka/partie, aby správca vedel priradiť podklady; toto označenie je dostupné len v administrácii a súkromnom upload portáli, nie vo verejnom serializátore. Každá nová pozvánka sa navyše priraďuje k dokončenej CRM zákazke; pracovníkovi sa zobrazí iba dátum a okres, nikdy meno zákazníka ani adresa. Identifikátor a celý stav zákazky zostávajú interné. Staré pozvánky bez väzby zostávajú čitateľné a neprepisujú sa. Príjem neotvára CRM a nové fotografie zostávajú súkromné. Portál vyžaduje dedikovaný `PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN`, oddelený od všeobecného upload tokenu, a väzbu na projekt/databázu/store. Implementácia zostáva vypnutá, kým sa v nastavení Vercel nezávisle nepotvrdí Private store, neodsúhlasia sa retenčné lehoty a neprejde preview end-to-end test.
2. Súkromný import originálov; evidovať meno súboru, SHA-256 hash skutočného obsahu, vlastníka a zdroj. Hash zostáva v internej databáze a verejný serializer ho nesmie vystaviť. Nezverejniť celý priečinok ani EXIF výpis.
3. Lokálne prečítať EXIF vrátane orientácie, GPS a času. Rozlíšiť chýbajúci/neplatný údaj, čas fotoaparátu a skutočný čas práce. Súradnica je návrh, nie dôkaz zákazky.
4. Navrhnúť obec/okres. Uprednostniť lokálny geografický podklad; neposielať presné GPS do novej externej služby bez dôvodu a schváleného spracovania.
5. Majiteľ potvrdí súvislosť so zákazkou, obec/okres, právo na použitie a jednotlivé vecné údaje. Štítky fotografie nesmú zamieňať stav pred/po.
6. Skontrolovať tváre, evidenčné čísla, domové čísla, listiny, adresy a rozpoznateľnosť domu. Publikovať len vhodný výrez alebo samostatne schválenú anonymizáciu. Žiadne AI vytváranie dôkazov či obsahové prerábanie práce.
7. Vytvoriť WebP/JPEG varianty, rozmery, srcset a alt; odstrániť všetky GPS/EXIF metadáta z verejnej kópie. Originál ostáva súkromný, nie v public/Git.
8. Vytvoriť súkromný draft prípadu naviazaný na tú istú dokončenú CRM zákazku ako fotografie; databáza odmietne pripojenie fotky z inej zákazky. Staré koncepty aj pozvánky bez väzby zostávajú kompatibilné, ale nové koncepty v administrácii vyžadujú dokončenú zákazku. Verejný bod až na úrovni obce/okresu; schváliť text aj každú fotografiu. Publikovanie až po schválení.
9. Mať možnosť prípad/fotku stiahnuť; preveriť CDN kópie a mapu. Evidovať schválenie aj stiahnutie.

Schválenú internú fotku možno z administrácie výslovne odobrať. Odobratie ju vyradí z použitia v konceptoch, zaznamená do auditu a zaradí do fronty bezpečného odstránenia; súkromný Blob sa zmaže až po úspechu mazacieho jobu a následne sa odstránia aj väzby na koncepty. Pri zlyhaní ostáva nedostupná pre realizácie a job mazanie opakuje. Odobratie nenahrádza postup na stiahnutie už publikovanej kópie ani kontrolu CDN; tieto kroky sú podmienkou budúceho verejného publikovania.

V pracovnej implementácii sa GPS/EXIF zatiaľ vôbec nevyťahuje; uložený originál je súkromný. Kategórie sú pre každú fotku nezávislé: rodinný dom, hospodárska budova, garáž, nelegálna skládka a interiér. Pracovník zadáva lokalitu ručne; produkčné zavedenie musí túto požiadavku vysvetliť a pri neznámej lokalite ponúknuť bezpečný odklad namiesto vymysleného miesta. Admin akcia „Schváliť interne“ nemení fotku na verejnú realizáciu.

## Model a oddelenie práv

| Objekt | Súkromné polia | Publikovateľné po schválení |
|---|---|---|
| Originál | interné ID zákazky, názov súboru, hash, presné GPS, EXIF, majiteľ, práva | Nič priamo |
| Prípad | zákazník, presná adresa, originály, pracovné podklady, interné ceny, schvaľovateľ | verejné ID/slug, obec alebo okres, typ objektu, problém, postup, výsledok, overená výmera/obdobie, schválené fotografie |
| Mapový bod | presné GPS a dôvod generalizácie | centroid obce/okresu z doloženého podkladu, úroveň presnosti, počet/prípady |
| Publikačný záznam | právo/súhlas alebo iný posúdený základ, dátum, rozsah a evidencia revízie | prípadne stručný pôvod fotografie, nie interné dokumenty |

Budúci stav prípadových štúdií: `draft → reviewed → approved → published → withdrawn`. Súčasný starší register realizácií má kratšie stavy; nové položky začínajú ako draft a zverejnenie vyžaduje správcovské potvrdenie práva použiť fotografie, kontrolu približnej lokality a internú referenciu podkladu. Zaznamenáva sa schvaľovateľ a čas. Referencia nie je sama o sebe dôkazom právnej platnosti. Verejný výstup nesmie obsahovať interné schvaľovacie údaje. Existujúce publikované záznamy sa automaticky nemenia, kým sa nepreverí ich pôvod. Schválenie firmy nenahrádza posúdenie práv zákazníka/osôb; keď je potrebné ďalšie oprávnenie, publikovanie čaká.

## UX mapy

- Ľahká SVG mapa Slovenska s doloženou licenciou podkladu. Žiadny externý mapový widget potrebný pre základné prehliadanie.
- **Mapový podklad:** použiť administratívne hranice SR od GKÚ Bratislava/ZBGIS, ideálne tretiu generalizovanú úroveň pre mierku 1:250 000–1:500 000. Oficiálny download uvádza CC BY 4.0 a stav dát k 25. 1. 2024; atribúcia autora a zdroja bude priamo pri mape aj v zdokumentovaní assetu. [Oficiálny download a licencia](https://www.gku.sk/geoportal-en/zbgis/download/). Nezamieňať s GISCO/Eurostat hranicami: podmienky ich štatistických jednotiek vylučujú komerčné použitie bez osobitnej licencie.
- Hranica správneho celku je len orientačný podklad. Fotografie sa na ňu neumiestňujú automaticky podľa GPS ani podľa textového odhadu. Verejný bod sa určí až zo schválenej obce/okresu a schváleného prípadu; na mape musí byť jasné, že ide o približnú lokalitu.
- Nadpis „Vybrané realizácie na Slovensku“. Text „Body označujú približnú obec alebo okres, nie presnú adresu stavby.“
- Verejný bod nie je náhodne posunuté GPS. Pri malej obci/identifikovateľnom objekte použiť okres alebo prípad bez mapového bodu.
- Zoskupiť viac prípadov v obci; filter služba/región, tlačidlo „Zobraziť realizácie“. Ovládanie klávesnicou a čítačkou, dotykové ciele aspoň44 px.
- Pod mapou serverovo vykreslený zoznam s rovnakými prípadmi. Všetko podstatné dostupné bez JavaScriptu, farba nie je jediný nositeľ informácie.
- Popis obsluhovaného Slovenska je oddelený od bodov vykonaných prác. Prázdny kraj neznamená, že tam nepracujeme, a nie je dôvod vložiť fiktívny bod.
- Detail obsahuje len doložené údaje, vlastné fotografie, priebeh a výsledok. Cena len ak je schválená, kontextová a neodhaľuje zákaznícku dohodu.

## Povinné testy a retenčná hranica

Automaticky: nevydané prípady nikdy v HTML/API/sitemap; serializer nevydá adresu/GPS; obrázky bez EXIF; URL neverejných originálov bez oprávnenia nečitateľné; po stiahnutí zmizne bod aj verejné odkazy. Ručne: vizuálna identifikovateľnosť a správnosť lokality, mobilný dialog, fokus, fallback zoznam, konzistencia počtu bodov a prípadov.

Pracovný automatický limit je 1 deň pre nedokončené nahratie, 30 dní pre čakajúcu kontrolu, 7 dní pre zamietnutý podklad a 180 dní pre interne schválený podklad. Je to technický horný limit dočasného príjmu, nie právne posúdenie ani schválená firemná politika; pred zapnutím portálu musí majiteľ potvrdiť, či zodpovedá skutočnému účelu. Mazací job najskôr uzamkne záznam do stavu `deletion_pending`, potom vymaže Blob a až po potvrdenom úspechu zmaže databázový riadok v transakcii s auditným záznamom. Pri chybe DB položka ostane v retry fronte a pokus sa opakuje denne. Verejný/worker media endpoint `deletion_pending` odmieta. Presné EXIF polohy nepatria do analytiky ani verejných logov. Približná mapa sama negarantuje anonymitu alebo súlad s ochranou osobných údajov.

Zostáva runtime overiť, že konkrétny produkčný Blob store je naozaj Private, Vercel cron je nasadený a reálne mazanie objektu + opakovanie po chybe funguje. Automatizovaný PGlite test kontroluje SQL stavy, výber všetkých štyroch retenčných tried, nevymazanie čerstvej fotky, retry chyby a transakčný audit po úspechu; nepokrýva externý Blob provider.

## Stav overenia poskytovateľa – 1. 10. 2026

Projekt používa `@vercel/blob` `^2.3.3`, čo spĺňa oficiálny minimálny SDK pre Private Storage. Jednorazový read-only test s lokálnym `BLOB_READ_WRITE_TOKEN` zavolal `get()` v private režime pre náhodný neexistujúci kľúč a provider odpovedal „not found“, nie chybou oprávnenia. Nečítal sa žiadny existujúci súbor a nič sa nenahrávalo ani nemazalo. To je dôkaz pre token v `.env.local`, nie pre produkčný Vercel deployment ani jeho samostatný token. Vercel rozlišuje private/public režim na úrovni Blob store a režim nemožno prepnúť; citlivé súbory sa majú doručovať cez autentifikovanú funkciu, nie cez verejnú Blob URL ([oficiálna dokumentácia Private Storage](https://vercel.com/docs/vercel-blob/private-storage), [porovnanie úložísk](https://vercel.com/docs/vercel-blob)).

**Rozhodnutie:** `PHOTO_INTAKE_PRIVATE_STORE_VERIFIED` a `PHOTO_INTAKE_ENABLED` sa v produkcii nemenia, kým sa nepotvrdí, že produkčný token smeruje na private store a neprejde test čítania bez oprávnenia/oprávneným adminom aj retenčný cron. Mazací cron má navyše nezávislý predvolene vypnutý prepínač `PHOTO_INTAKE_RETENTION_ENABLED`; bez presnej hodnoty `true` po autorizácii bezpečne preskočí prácu a nič neclaimne ani nemaže. Tento prepínač sa nesmie zapnúť, kým majiteľ neschváli retenciu 1/30/7/180 dní a lifecycle fotiek pripojených k súkromným konceptom. Pri výslovnom zapnutí sa aj naďalej vyžaduje platná väzba produkčného Private Blobu na projekt/databázu/token. Lokálny úspech nemožno rozšíriť na produkciu.

## Základný mapový podklad – 1. 10. 2026

Z oficiálneho balíka GKÚ `USJ_hranice_3.gpkg` bola vytvorená ľahká SVG silueta SR v `public/assets/maps/slovakia-admin-3.svg`. Zdrojová stránka uvádza hranice správneho usporiadania vo formáte GPKG, súradnicový systém EPSG:5514, generalizované úrovne, autora GKÚ Bratislava a licenciu CC BY 4.0. GeoPackage vrstva bola lokálne vykreslená bez externého mapového runtime; originálny balík sa do Git/repozitára nepridáva. Vygenerovanie možno zopakovať pomocou `scripts/generate-slovakia-map.mjs <USJ_hranice_3.gpkg> <výstup.svg>`.

SVG nesie atribúciu pri zdroji aj v metadátach. Je to iba hranica územia, nie mapa výkonov. Neobsahuje žiadne vymyslené ani zákaznícke body; kým nebude zavedený publikovateľný workflow prípadov a tím nepotvrdí obce, nesmie sa prezentovať ako dôkaz prác v jednotlivých regiónoch. Zdroj: [GKÚ – ZBGIS na stiahnutie](https://www.gku.sk/geoportal-en/zbgis/download/), dátový stav stránky 25. 1. 2024; vložená geometria má metadátový dátum `2026-06-30`.
