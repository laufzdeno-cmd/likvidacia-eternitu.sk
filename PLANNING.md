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

## Brána 2 — landing pages a meranie (2026-08-13)

- Zachovať existujúcu informačnú architektúru, formuláre, admin a databázový model; meniť iba texty, atribúciu a meranie potrebné pred spustením kampaní.
- Hlavná landing page používa finálne posolstvo o koordinácii so strechárom, ponuke do 24 hodín a transparentné podmienky akcie nad 100 m².
- Nesprávny claim o rozhodnutí RÚVZ nahrádza presné vysvetlenie písomného oznámenia najmenej 30 dní pred bežnými prácami.
- Lead ukladá GCLID/GBRAID/WBRAID, UTM a identifikátory kampane, reklamnej skupiny, kreatívy, zariadenia a vstupnej stránky bez zásahu do existujúcich tabuliek.
- Konverzná udalosť sa odošle až po úspešnom uložení leadu a používa serverové lead ID ako transaction/reference ID; session deduplikácia bráni opakovanému eventu.
- Google meranie používa Consent Mode a cross-domain linker pre astana.sk a oba pomocné weby; súhlas možno rovnako jednoducho udeliť, odmietnuť aj zmeniť.
- Pred produkciou sú povinné typecheck/build, preview QA na desktop/mobile, kontrola URL, formulára, cookies a dátového eventu. Produkčný formulár sa nesmie skúšať bez jasne označeného QA leadu.
# Vizuálny hotfix Brány 2 — 13. 8. 2026

- Cieľ: opraviť iba rozbitú šírku bloku „Ako rozoznať legálnu likvidáciu azbestu“ bez zásahu do formulára, merania alebo dát.
- Riešenie: z bloku vytvoriť samostatnú, centrovanú a responzívnu informačnú kartu s čitateľnou dĺžkou riadkov.
- Bezpečnosť zmeny: iba CSS; žiadna zmena API, databázy, uploadov, e-mailov ani analytických udalostí.
- Overenie: typecheck, produkčný build a vizuálna kontrola desktopu aj mobilu.
