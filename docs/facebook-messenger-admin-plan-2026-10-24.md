# Facebook Messenger v administrácii — realizačný plán

## Zámer a používateľ

ASTANA potrebuje spracovať správy z firemnej Facebook stránky rovnako prehľadne ako webové dopyty. Primárnymi používateľmi sú operátorky, ktoré majú vidieť nové konverzácie, prideliť si ich, pripraviť odpoveď a až po vlastnej kontrole ju odoslať. Superadmin pripája alebo odpája Facebook stránku a kontroluje technický stav.

Jediná hlavná akcia obrazovky je bezpečne odpovedať zákazníkovi. Asistent smie navrhnúť text, nikdy ho nesmie odoslať automaticky.

## Rozsah prvej verzie

- doručené a odoslané správy Facebook Page Messenger,
- počet neprečítaných správ, priradenie aktívnemu administrátorovi a pracovný stav,
- zobrazenie 24-hodinového okna a serverové zablokovanie odpovede po jeho uplynutí,
- ručné odoslanie skontrolovanej odpovede,
- bezpečné predpripravené odpovede bez automatického odoslania,
- prepojenie konverzácie s existujúcim dopytom,
- audit zmien a odoslaní,
- pripojenie konkrétnej Facebook stránky cez Meta OAuth iba superadminom.

Komentáre pod príspevkami, Instagram a Lead Ads nie sú súčasťou tejto verzie. Majú odlišné oprávnenia aj pracovné postupy a budú sa pridávať samostatne.

## Bezpečnostné rozhodnutia

- Facebook heslo sa v administrácii nikdy nezadáva ani neukladá.
- Page access token sa ukladá iba serverovo, šifrovaný pomocou AES-256-GCM.
- Webhook prijme dáta iba s platným podpisom `X-Hub-Signature-256`.
- OAuth `state` je jednorazový, expirovaný a viazaný na prihláseného superadmina.
- Integrácia je fail-closed: neúplná konfigurácia nič neodosiela a v UI sa nezobrazuje ako aktívna.
- Prílohy z Facebooku sa v prvej verzii nepublikujú ani nekopírujú na verejný web. Ukladá sa iba ich typ.
- Neistý sieťový výsledok odoslania sa označí ako neznámy a automaticky sa neopakuje.

## Dátový model

- `facebook_page_connections`: identita stránky, šifrovaný token, stav a audit pripojenia,
- `facebook_oauth_states`: jednorazové OAuth stavy bez ukladania tokenov,
- `facebook_conversations`: zákazník, pridelenie, pracovný stav, počet nových správ a voliteľné prepojenie na dopyt,
- `facebook_messages`: idempotentne uložené prijaté/odoslané správy a stav doručovania.

Schéma je aditívna. Existujúce tabuľky dopytov, ponúk, zákaziek, merania ani verejné formuláre sa nemenia.

## Prevádzka a merateľnosť

Admin zobrazuje technický stav konfigurácie, pripojenú stránku, čas posledného webhooku a počty nových konverzácií. Každá zmena stavu, pridelenia, prepojenia na dopyt a odoslanie odpovede má auditný záznam bez prístupových tokenov.

## Akceptácia

1. Bez konfigurácie zostane modul viditeľne vypnutý a ostatný admin funguje bez zmeny.
2. Falošný podpis webhooku sa odmietne bez zápisu.
3. Duplicitný provider message ID nevytvorí druhú správu.
4. Operátor nevidí token a nevie pripojiť alebo odpojiť stránku.
5. Odpoveď sa odošle iba po ručnom stlačení tlačidla a iba v povolenom 24-hodinovom okne.
6. Build, typová kontrola, cielené testy a mobilná aj desktopová vizuálna kontrola prejdú pred nasadením.

## Produkčné OAuth overenie — 25. 10. 2026

Produkčný OAuth tok úspešne udelil prístup k jednej vybratej stránke ASTANA, ale volanie `/me/accounts` nevrátilo použiteľný Page access token. OAuth preto musí žiadať aj `pages_read_engagement`, ktoré dopĺňa `pages_show_list`, `pages_messaging` a `pages_manage_metadata` pri bezpečnom získaní tokenu vybratej stránky. Rozsah zostáva obmedzený na čítanie základných údajov stránky potrebných na pripojenie; automatické odosielanie správ ani publikovanie obsahu sa tým nezapína.
