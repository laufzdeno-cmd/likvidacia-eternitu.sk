# Inventár a jedinečné priradenie fotografií – 27. 10. 2026

Stav vstupného náhľadu: **RETURN WITH DEFECTS** pre požiadavku bez opakovania fotografií. Autor zmeny: hlavný Codex; tento inventár je nezávislé čítacie zistenie. Aplikačný kód som nemenil.

## Čo je overené

- Aktuálny lokálny render všetkých35 verejných URL zo sitemapy; hlavný obsah img/picture vrátane odložených obrázkov. Galéria na /realizacie/ bola rozbalená tlačidlom Zobraziť ďalšie realizácie až na30 kariet.
-79 výskytov:42 rozdielnych ID/cestných identít, po presných aliasoch **41 fotografických identít**. **19 identít sa opakuje**. Responzívne JPEG/WebP/AVIF varianty, noscript fallback a lightbox náhľad sa nepočítajú ako nové fotografie.
- /realizacie/ má34 statických výskytov (4 hero +30 galéria), ale iba31 skutočných identít:057 a106 sú v hero aj galérii;025 a026 sú tá istá fotografia pod rôznym ID.
- CSS fotografické pozadia v skutočne zobrazovanom main: žiadne pri1440 ani390px na všetkých35 URL. Pseudo prvky boli zahrnuté; logá, ikony, SVG diagramy a sociálne metaobrázky sú mimo obsahového inventára.
- Na verejnej ostrej /realizacie/ bol HTTP200 s deploymentom dpl_83nkWGS5XJ1kqXBVDHMvSbi1LKi8. Verejný HTML render neobsahoval published-realization-card ani approved-case-map-title. To potvrdzuje neprítomnosť dynamických kariet/prípadov na prečítanej stránke, nie priamy stav súkromnej databázy. DB ani tajomstvá sa nečítali.

## Knižnica a identita

-179 originálnych JPEG +179 WebP +8 hero derivátov =366 súborov v public/assets/azbest. Rozmery originálov:1040×780,1600×900/960/1204/1205 alebo portréty1200/1204/1205×1600. Názov vlastný originál vychádza z potvrdenia majiteľa; geografiu či konkrétneho zákazníka neodvodzujem z fotografie.
- Pred zmenou je po známych presných aliasoch voľných137 originálnych identít. Nie je potrebné generovať alebo kupovať nové fotografie.
- /og/cena-strecha-realizacia.jpg je vizuálne overený crop azbest-150; na cenovej stránke môže zostať optimalizovaný crop, ID150 musí byť globálne rezervované.
- azbest-013.jpg a014.jpg sú byte-identické; rovnako025.jpg a026.jpg. Navrhnuté kanonické aliasy sú013→014 a025→026, pretože vo finálnom výbere zostávajú014 a026.
- Dvojice106/107 a115/116 sú veľmi podobné zábery podľa dHash/obrazu, nie byte-identické. Finálny výber nepoužíva ani jednu takú dvojicu súčasne.
- Pôvodný /assets/roofers/roofer-installing-new-roof.webp nemá doložený obrazový alias v azbest knižnici. Návrh ho nahrádza známym vlastným163. Nemá sa falošne normalizovať na163 ako keby išlo o ten istý súbor.

## Najmenšia implementácia

Jeden typovaný register route→readonly ID[] bez importov v src/content/public-photo-assignments.ts. Pomocné funkcie pagePhotoIds(route), pagePhotoId(route,index), publicPhotoIdentity(src) použijú obsahové dáta aj spoločné komponenty. Normalizácia rozbalí /_next/image url parameter, zjednotí jpeg/webp/avif/hero deriváty a explicitné aliasy. Logo nie je obsahová fotka.

Register má **79/79 jedinečných ID**, **79/79 rôznych JPEG SHA-256**, a žiadny blízky pár pri63-bit DCT pHash prahu≤8. Toto je silná mechanická kontrola opakovaného záberu, nie tvrdenie o79 rozdielnych zákazkách. Vizuálne boli skontrolované všetky79 snímky na kontaktných hárkoch. Návrh bol koordinovaný s root a workerom; posledná prijatá výmena je galériový001→143, aby mal filter balenie/odvoz pravdivý obsah.

Každá obsahová podstránka dostane vlastný záber. Karty poradne majú iné snímky než články. Galéria má vlastné disjunktné4+30 a stále len12 počiatočných kariet s existujúcim načítaním zvyšných. Zachovať ResponsiveImage, sizes, explicitné rozmery, eager iba hlavnýhero a lazy pod záhybom. JSONLD a klient galérie musia používať rovnaký finálny zoznam ako SSR.

Aktuálna statická úprava nemusí filtrovať súkromné záznamy ani meniť DB. Budúce nové publikované fotografie sa nedajú spoľahlivo porovnať iba podľa novej Blob URL; do budúcna patrí upozornenie na duplicitný obsah k schváleniu/publikovaniu, nie tiché odfiltrovanie súkromných dát v tomto rozsahu. Počet aktuálne publikovaných dynamických fotiek na prečítanom verejnom renderi je0.

## Komponentové sloty pre implementáciu

| Súbor | Sloty |
| --- | --- |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/page.tsx | heroImage specialized087 derivatives; homepageHighlights[0]; homepageHighlights[1]; homepageHighlights[2] |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/seo-components.tsx | ServicePage EditorialHero.photoId/alt/caption |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/cena-likvidacie-azbestu/page.tsx | price-hero-photo Image.src existing crop, register reserves150 |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/postup/page.tsx | heroPhoto; roofPhoto; packingPhoto; sitePhoto |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/kde-posobime/page.tsx | EditorialHero.photoId/alt/caption |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/faq/page.tsx | EditorialHero.photoId/alt/caption |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/recenzie/page.tsx | reviews-context EditorialPhoto.id/alt/caption |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/o-firme/page.tsx | EditorialHero.photoId/alt/caption |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/kontakt/page.tsx | EditorialHero.photoId/alt/caption |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/poradna/page.tsx | EditorialHero at index0; eight cards in existing articles order at indexes1..8; must not reuse article.photoId |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/strechari/page.tsx | roofer-b2b-hero-media image replaces unrelated roofing path with163; use metadata alt |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/kariera/page.tsx | EditorialPhoto.id/alt/caption |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/app/spolupracujuci-strechari/page.tsx | EditorialHero.photoId/alt/caption |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/src/content/regional-guides.ts | photoId and photoAlt for each slug; render in LocationPage app/seo-components.tsx |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/src/content/advice-articles.ts | photoId and photoAlt/photoCaption for article slug; ArticlePage renders same metadata |
| C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/src/data/azbestReferences.ts | realizationHeroStripReferences = first4; galleryReferences = remaining30; shared SSR, JSONLD, JS gallery client must import identical galleryReferences |

Pri výmene ID treba súčasne použiť vecný alt/title z manifest-records.json, nie ponechať starý opis inej budovy. Opravených je aj40 existujúcich vybraných záznamov: napr.001–004 sú interiéry priemyselnej haly,018 ešte krytina počas ošetrenia,063 technologická veža,065 vozidlo,120/121 priemyselné pracovné plochy. Nových je39 záznamov, spolu79. Nepridávať dátumy, lokality, výmery ani tvrdenia o preukázanom zložení iba z vizuálu.

## Aktívne fotografie pred opravou

| URL | Fotografické ID (azbest prefix skrátený) |
| --- | --- |
| / | 087, 164, 057, 110 |
| /likvidacia-azbestu/ | 111 |
| /likvidacia-eternitu/ | 087 |
| /cena-likvidacie-azbestu/ | 150 |
| /postup/ | 164, 051, 121, 068 |
| /kde-posobime/ | 065 |
| /faq/ | 132 |
| /realizacie/ | 087, 057, 106, 121, 134, 130, 006, 132, 011, 017, 014, 021, 022, 026, 118, 124, 106, 063, 119, 007, 012, 111, 001, 002, 057, 003, 004, 005, 023, 026, 120, 123, 171, 160 |
| /recenzie/ | 068 |
| /o-firme/ | 111 |
| /kontakt/ | 065 |
| /poradna/ | 118, 130, 135, 134, 120, 118, 068, 171, 091 |
| /strechari/ | /assets/roofers/roofer-installing-new-roof.webp |
| /kariera/ | 135 |
| /spolupracujuci-strechari/ | 007 |
| /likvidacia-azbestu-poprad/ | 164 |
| /likvidacia-azbestu-kosice/ | 110 |
| /likvidacia-azbestu-presov/ | 135 |
| /likvidacia-azbestu-zilina/ | 118 |
| /likvidacia-azbestu-banska-bystrica/ | 057 |
| /likvidacia-azbestu-bratislava/ | 134 |
| /likvidacia-azbestu-nitra/ | 091 |
| /likvidacia-azbestu-trnava/ | 068 |
| /likvidacia-azbestu-trencin/ | 069 |
| /poradna/co-je-eternit-a-kedy-obsahuje-azbest/ | 130 |
| /poradna/preco-neodstranovat-eternit-svojpomocne/ | 135 |
| /poradna/kolko-stoji-likvidacia-azbestu/ | 134 |
| /poradna/ake-doklady-dostanete-po-likvidacii-azbestu/ | 120 |
| /poradna/ako-zmerat-strechu-pre-cenovu-ponuku/ | 118 |
| /poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/ | 068 |
| /poradna/azbest-v-interieri-vs-exterieri/ | 171 |
| /poradna/odvoz-a-balenie-azbestoveho-odpadu/ | 091 |
| /ochrana-osobnych-udajov/ | — |
| /cookies/ | — |
| /podmienky-pouzivania/ | — |

## Opakované identity pred opravou

| Identita | Výskyty URL |
| --- | --- |
| azbest-087 | / · /likvidacia-eternitu/ · /realizacie/ |
| azbest-164 | / · /postup/ · /likvidacia-azbestu-poprad/ |
| azbest-057 | / · /realizacie/ · /realizacie/ · /likvidacia-azbestu-banska-bystrica/ |
| azbest-110 | / · /likvidacia-azbestu-kosice/ |
| azbest-111 | /likvidacia-azbestu/ · /realizacie/ · /o-firme/ |
| azbest-121 | /postup/ · /realizacie/ |
| azbest-068 | /postup/ · /recenzie/ · /poradna/ · /likvidacia-azbestu-trnava/ · /poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/ |
| azbest-065 | /kde-posobime/ · /kontakt/ |
| azbest-132 | /faq/ · /realizacie/ |
| azbest-106 | /realizacie/ · /realizacie/ |
| azbest-134 | /realizacie/ · /poradna/ · /likvidacia-azbestu-bratislava/ · /poradna/kolko-stoji-likvidacia-azbestu/ |
| azbest-130 | /realizacie/ · /poradna/ · /poradna/co-je-eternit-a-kedy-obsahuje-azbest/ |
| azbest-026 | /realizacie/ · /realizacie/ |
| azbest-118 | /realizacie/ · /poradna/ · /poradna/ · /likvidacia-azbestu-zilina/ · /poradna/ako-zmerat-strechu-pre-cenovu-ponuku/ |
| azbest-007 | /realizacie/ · /spolupracujuci-strechari/ |
| azbest-120 | /realizacie/ · /poradna/ · /poradna/ake-doklady-dostanete-po-likvidacii-azbestu/ |
| azbest-171 | /realizacie/ · /poradna/ · /poradna/azbest-v-interieri-vs-exterieri/ |
| azbest-135 | /poradna/ · /kariera/ · /likvidacia-azbestu-presov/ · /poradna/preco-neodstranovat-eternit-svojpomocne/ |
| azbest-091 | /poradna/ · /likvidacia-azbestu-nitra/ · /poradna/odvoz-a-balenie-azbestoveho-odpadu/ |

## Finálny návrh priradení

Prvé4 ID /realizacie/ patria hero-stripu, zvyšných30 galérii. Prvé ID /poradna/ je hlavný hero; ďalších8 patria kartám v pôvodnom poradí článkov. Právne3 URL ostávajú bez dekoratívnych fotografií.

| URL | ID (azbest prefix skrátený) |
| --- | --- |
| / | 087, 164, 057, 110 |
| /likvidacia-azbestu/ | 111 |
| /likvidacia-eternitu/ | 018 |
| /cena-likvidacie-azbestu/ | 150 |
| /postup/ | 027, 051, 121, 068 |
| /kde-posobime/ | 065 |
| /faq/ | 132 |
| /recenzie/ | 090 |
| /o-firme/ | 067 |
| /kontakt/ | 050 |
| /poradna/ | 118, 033, 054, 079, 081, 028, 048, 060, 080 |
| /strechari/ | 163 |
| /kariera/ | 075 |
| /spolupracujuci-strechari/ | 007 |
| /likvidacia-azbestu-poprad/ | 084 |
| /likvidacia-azbestu-kosice/ | 108 |
| /likvidacia-azbestu-presov/ | 039 |
| /likvidacia-azbestu-zilina/ | 113 |
| /likvidacia-azbestu-banska-bystrica/ | 042 |
| /likvidacia-azbestu-bratislava/ | 155 |
| /likvidacia-azbestu-nitra/ | 049 |
| /likvidacia-azbestu-trnava/ | 031 |
| /likvidacia-azbestu-trencin/ | 069 |
| /poradna/co-je-eternit-a-kedy-obsahuje-azbest/ | 130 |
| /poradna/preco-neodstranovat-eternit-svojpomocne/ | 135 |
| /poradna/kolko-stoji-likvidacia-azbestu/ | 134 |
| /poradna/ake-doklady-dostanete-po-likvidacii-azbestu/ | 120 |
| /poradna/ako-zmerat-strechu-pre-cenovu-ponuku/ | 088 |
| /poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/ | 036 |
| /poradna/azbest-v-interieri-vs-exterieri/ | 171 |
| /poradna/odvoz-a-balenie-azbestoveho-odpadu/ | 091 |
| /realizacie/ | 083, 043, 094, 172, 006, 011, 017, 014, 021, 022, 026, 124, 063, 119, 012, 143, 002, 003, 004, 005, 023, 123, 160, 019, 024, 032, 035, 041, 046, 053, 056, 064, 066, 074 |

Galéria30 pokrýva všetky kategórie: rodinne-domy:12, hospodarske-budovy:6, priemysel:7, interier:2, balenie-odvoz:1, strechari:2.

## Dôkazy

- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/inventory.json – runtime výskyty a metadáta179 originálov.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/backgrounds.json a backgrounds-390.json – CSS pozadia.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/proposed-map.json – presné79 priradenia.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/component-slots.json – strojová mapa súborov/slotov.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/manifest-records.json –79 overených titulkov/alt/kategórií.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/proposal-fingerprints.json – SHA a pHash kontrola79.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/proposed-1.png až proposed-3.png – kontaktné hárky79 priradení.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/free-1.png až free-4.png – kontaktné hárky voľných originálov.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/extra-1.png – cenový crop vedľa150; extra-2.png – starý strechársky obrázok a odlišné originály.
- C:/WEB/DIGITAL24.sk/likvidacia-eternitu.sk/tmp/public-photo-inventory/live-realizacie.html – verejný HTML snapshot, iba čítanie.

## Hranice záveru

Finálna implementácia musí po integrácii prejsť novým renderovaným inventárom a nezávislou vizuálnou kontrolou; tento report sám neprehlasuje hotové nasadenie. Skryté DB záznamy, súkromné fotky, Google indexovanie a pridelenie práv k novým uploadom sa neoverovali. Aplikačný kód ani produkcia neboli týmto prieskumom menené.
