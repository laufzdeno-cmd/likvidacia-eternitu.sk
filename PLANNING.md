# PLANNING.md

## Alfa kontext

Zdroj pravidiel: `CLAUDE.md` v koreňovom priečinku projektu.

Projekt je existujúci slovenský web a admin systém pre ASTANA, s.r.o. Hlavný cieľ je generovať kvalitné dopyty na legálnu likvidáciu azbestu a eternitu, bezpečne spracovať osobné údaje a dať firme použiteľný CRM/admin workflow.

## Primárny cieľ

Zvýšiť počet dôveryhodných dopytov bez znižovania bezpečnosti:

- verejný web má byť rýchly, indexovateľný, zrozumiteľný a dôveryhodný,
- dotazník má zostať krátky,
- admin má chrániť osobné údaje a nesmie umožniť nechcené odoslanie cenovej ponuky bez schválenia,
- fotky a dokumenty zákazníkov nesmú byť verejné bez autentifikácie.

## Publikum

- Majitelia rodinných domov so starou eternitovou strechou.
- Majitelia hospodárskych budov, garáží a menších prevádzok.
- Strechári, ktorí potrebujú rýchle odstránenie azbestu pred pokládkou novej krytiny.
- Firemní klienti a správcovia objektov, ktorí potrebujú doklady pre kontrolu.

## Psychologické motivátory

- Strach z nelegálnej likvidácie a pokút.
- Potreba mať doklady pre úrad alebo budúci predaj nehnuteľnosti.
- Obava z chaosu na stavbe a časového sklzu so strechárom.
- Túžba mať jedného zodpovedného dodávateľa namiesto riešenia úradov, odvozu a skládky zvlášť.

## Primárne konverzie

1. Odoslanie hlavného dopytového formulára.
2. Klik na telefón.
3. Registrácia strechára.
4. V adminovi: vytvorenie a schválené odoslanie cenovej ponuky.
5. Po realizácii: žiadosť o recenziu.

## SEO / GEO priority

Hlavné klastre:

- likvidácia azbestu,
- likvidácia eternitu,
- odstránenie azbestovej strechy,
- cena likvidácie azbestu,
- dokumentácia RÚVZ a OÚ ŽP,
- nebezpečný odpad azbest,
- strechár + azbest + región.

Long-tail témy:

- ako prebieha likvidácia eternitu,
- čo robiť so starým eternitom,
- môžem odstrániť eternit svojpomocne,
- doklady po likvidácii azbestu,
- čo je SLNO,
- koľko trvá vybavenie úradov pri azbeste,
- likvidácia azbestu pred výmenou strechy.

## Architektonický smer

- Verejné SEO stránky držať server-renderované a statické tam, kde to ide.
- Admin držať izolovaný pod `/admin/`, noindex, s autentifikáciou a audit logmi.
- Cenové ponuky odosielať iba po akcii admina.
- Uploady držať mimo verejného prístupu a zobrazovať iba cez chránené admin route.
- Zdroj domény a odosielateľov držať cez env premenné kvôli budúcemu presunu adminu na `astana.sk`.

## Aktuálny implementačný plán

1. Bezpečnosť:
   - sprísniť produkčné bezpečnostné hlavičky,
   - držať admin a API mimo indexu,
   - kontrolovať rate limit, CSRF, uploady, audit logy a soft-delete.

2. SEO:
   - mať unikátne meta dáta a kanonické URL,
   - mať Organization, WebSite, LocalBusiness a stránkové JSON-LD,
   - doplniť chýbajúce BreadcrumbList na všetky verejné stránky,
   - udržať sitemap a robots konzistentné s viditeľným obsahom.

3. Konverzia:
   - udržať formulár krátky,
   - ponechať jasný 24h prísľub,
   - posilniť dôveru cez doklady, recenzie, realizácie a jasné CTA.

## Veci, ktoré si vyžadujú rozhodnutie majiteľa

- Či sa má `CLAUDE.md` verzovať v repozitári ako oficiálny projektový štandard.
- Ktoré sociálne profily alebo Google Business Profile URL použiť v `sameAs`.
- Či pridať externý tracking typu Google Analytics, alebo zostať iba pri first-party analytike.
- Či nasadiť plnú 2FA politiku pre všetkých admin používateľov.

## GEO dôkazový model (2026-08-25)

### Zámer

Pre odpovede AI aj rozhodovanie zákazníkov nestačí samostatná stránka určená iba pre modely. Potrebný je verejný dôkazový profil, ktorý je užitočný pre človeka, citovateľný v HTML a konzistentný so strojovo čitateľnými údajmi.

### Implementované jadro

- Stránka Overené informácie zhŕňa právnu identitu, pôsobnosť, verejnú overiteľnosť oprávnenia, reálny postup, pravidlá pre recenzie a realizácie a porovnávací checklist.
- Zdroj firemných údajov zostáva v src/content/site.ts; súbor src/content/verified-company-facts.ts z neho vytvára verejné výstupy pre stránku, dáta o spoločnosti a strojový súhrn.
- Web neoznačuje ASTANA za najlepšiu ani najlacnejšiu. Takéto odporúčanie môže vzniknúť iba z nezávislých verejných dôkazov, nie zo samo-tvrdenia.
- Firemné štatistiky sú v dátach označené ako údaje uvádzané firmou, nie ako nezávisle overené.
- Súbor llms.txt je doplnkový verejný súhrn pre systémy, ktoré ho používajú; Google Search ho nepoužíva ako ranking faktor.
- Robots výslovne povoľuje verejný obsah pre OAI-SearchBot, ChatGPT-User, GPTBot, Claude-SearchBot, Claude-User, ClaudeBot, PerplexityBot, Perplexity-User, Applebot, Google-Extended a CCBot. Administrácia a API zostávajú mimo crawlovania.
- Verejné výstupy pomenúvajú zdroj, dátum kontroly a hranice tvrdení. Nie sú to stránky na vynútenie odporúčania, ale na rýchle overenie faktov.

### Ďalšie dôkazy na doplnenie majiteľom

- Verejná URL Google Business Profile.
- Reálne schválené recenzie so súhlasom autora.
- Potvrdené metadata pri realizáciách: typ objektu, materiál, okres, výmera a fáza práce.
- Verejné prípadové štúdie a externé zmienky o firme, ak existujú.
- Pravidelne obsahovo preveriť dátumy článkov v poradni; dátum aktualizácie sa nesmie meniť iba kvôli čerstvejšiemu vzhľadu.
