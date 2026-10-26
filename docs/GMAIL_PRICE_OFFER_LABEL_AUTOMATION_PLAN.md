# Automatické označenie odoslaných cenových ponúk v Gmaili

## Zámer a používateľ

- **Služba:** interné CRM pre dopyty, cenové ponuky a realizácie likvidácie azbestu.
- **Primárny používateľ:** Jarka a Slavka pri každodennom spracovaní ponúk; superadmin pri správe integrácie a riešení výnimiek.
- **Skutočná potreba:** po schválenom odoslaní ponuky musí byť v Gmaili na prvý pohľad jasné, že ide o vybavenú cenovú ponuku, bez ručného hľadania a označovania.
- **Jediná hlavná akcia:** pracovníčka skontroluje ponuku a odošle ju existujúcim schvaľovacím tlačidlom. Gmail označenie je následná automatizácia, nie ďalší krok odoslania.

Toto je interná, neindexovaná funkcia. Keyword analýza, verejná sitemap, SEO schéma, hreflang, dark mode a e-shop nie sú pre túto zmenu relevantné. Verejný web, formulár, reklamy a meranie sa nemenia.

## Používateľský výsledok

1. Admin po výslovnom schválení odošle profesionálnu cenovú ponuku rovnakým spôsobom ako dnes.
2. SMTP musí najprv potvrdiť prijatie adresy zákazníka.
3. Aplikácia v jednej databázovej transakcii uloží stav `ODOSLANA` a úlohu na Gmail označenie.
4. Samostatný worker nájde presnú Gmail kópiu podľa RFC 822 `Message-ID`. Ak existuje práve jedna verzia so systémovým štítkom `SENT`, uprednostní ju; inak prijme iba jednu jednoznačnú zhodu.
5. Správa dostane zelený vlastný štítok `✓ CP odoslaná` a systémový stav `STARRED`.
6. Admin zobrazuje samostatne stav ponuky a stav Gmail označenia.

Gmail API nesprístupňuje výber konkrétnej ikony „green-check“ zo Superstars. Stabilná programová náhrada je zelený vlastný štítok; všeobecná hviezdička sa pridá ako sekundárny vizuálny signál.

## Bezpečnostné rozhodnutia

- Gmail heslo sa nikdy nezadáva ani neukladá v adminovi.
- Pripojenie vykoná iba superadmin cez Google OAuth 2.0.
- Používa sa najmenší scope, ktorý podporuje vyhľadanie odoslanej správy a pridanie štítka: `gmail.modify`.
- OAuth používa jednorazový `state`, PKCE S256, desaťminútovú platnosť a väzbu na prihláseného superadmina.
- Refresh token aj dočasný PKCE verifier sú v databáze šifrované AES-256-GCM. Šifrovací kľúč a OAuth client secret sú iba produkčné Vercel Secret premenné.
- Aplikácia neukladá telo Gmail správ. Ukladá iba interné ID ponuky, RFC 822 Message-ID, technický Gmail message ID a prevádzkový stav.
- Chyby a audit neobsahujú tokeny, adresy zákazníkov, predmety ani telá správ.
- Odpojenie Gmailu revokuje token najlepším možným spôsobom a lokálne pripojenie deaktivuje aj v prípade nedostupnosti Google.

## Spoľahlivosť a ochrana pred duplicitou

| Situácia | Stav ponuky | Gmail úloha | Správanie |
| --- | --- | --- | --- |
| SMTP odmietne zákazníka | `PRIPRAVENA` | nevznikne | možno opraviť a odoslať znova |
| SMTP výsledok je neistý | `NEISTY_STAV` | nevznikne | pred opakovaním sa musí skontrolovať schránka |
| SMTP potvrdí a DB transakcia uspeje | `ODOSLANA` | `pending` | worker označí Gmail |
| Gmail je dočasne nedostupný | `ODOSLANA` | `retry` | ponuka sa nikdy neposiela znova |
| Gmail nájde 0 správ | `ODOSLANA` | `retry`, potom `attention` | čaká sa na indexáciu, potom ručná kontrola |
| Gmail nájde viac správ | `ODOSLANA` | `attention` | žiadne hádanie ani hromadná zmena |
| Gmail označenie už existuje | `ODOSLANA` | `completed` | idempotentný úspech |

Odoslanie ponuky a vytvorenie Gmail úlohy sú atómové. Worker nikdy neposiela email a nikdy nemení obchodný stav ponuky.

## Dátový model

- `gmail_connections`: jedno aktívne firemné pripojenie, šifrovaný refresh token, email účtu, ID/názov štítka a zdravotný stav.
- `gmail_oauth_states`: krátkodobý jednorazový OAuth state a šifrovaný PKCE verifier.
- `gmail_price_offer_label_jobs`: outbox s jedinečnou väzbou na ponuku a Message-ID, stavmi `pending`, `processing`, `retry`, `completed`, `attention`, počtom pokusov a bezpečnými chybovými kódmi.

## Admin informačná architektúra

- **Nastavenia → Prepojenie Gmailu** (iba superadmin): stav konfigurácie, pripojený účet, OAuth pripojenie/odpojenie, počet čakajúcich a problémových úloh.
- **Detail cenovej ponuky:** po odoslaní krátky stav „Gmail označený“, „čaká na označenie“ alebo „treba skontrolovať“.
- **Kontrola systému:** pripravenosť konfigurácie bez zobrazenia tajomstiev.

Operátori nemajú prístup k OAuth nastaveniam ani tokenom. Automatické označenie však funguje pre ponuky, ktoré oprávnene odošlú.

## Výkon a prevádzka

- Odosielacia akcia nevykonáva Gmail API volanie; pridá iba jeden malý outbox záznam v už otvorenej transakcii.
- Vercel Cron spracuje malé dávky každých päť minút.
- Retry používa rastúci odstup a konečný stav `attention`; nekonečné pokusy nie sú povolené.
- API požiadavky majú timeout a kontrolované chybové kódy.

## Akceptačné kritériá

- Bez explicitného admin schválenia sa cenová ponuka naďalej neodošle.
- Potvrdené odoslanie vytvorí presne jednu Gmail úlohu.
- Retry Gmailu nikdy nevolá SMTP a nemení `sentAt` ani stav ponuky.
- OAuth callback odmietne chýbajúci, použitý, exspirovaný alebo cudziemu adminovi patriaci state.
- Token sa nedostane do HTML, URL, audit logu ani výpisu chyby.
- Nepripojený Gmail neblokuje odosielanie ponúk; admin jasne vidí čakajúce úlohy.
- Testy pokryjú konfiguráciu, šifrovanie, OAuth state, idempotenciu, presné párovanie Message-ID, retry a autorizáciu cronu.
- TypeScript, relevantné testy, produkčný build, kandidát a živý read-only smoke musia prejsť pred povýšením do produkcie.

## Nasadenie a návrat späť

1. Doplniť produkčné Vercel Secret premenné a Google OAuth redirect URI.
2. Nasadiť najprv otestovaný produkčný kandidát bez priradenia domény.
3. Overiť login, superadmin nastavenia, OAuth start, cron autorizáciu a verejný web bez zápisov.
4. Povýšiť presne overený kandidát.
5. Pripojiť určený Gmail účet cez superadmina.
6. Urobiť syntetický test na internú adresu; nie na zákazníka.
7. Pri regresii vrátiť predchádzajúci deployment. Gmail worker je oddelený, takže rollback nespôsobí opätovné odoslanie ponúk.

## Verejné vysvetlenie pre Google OAuth (26. 10. 2026)

- Existujúca domovská stránka vysvetľuje likvidáciu azbestu, nie internú aplikáciu „ASTANA – cenové ponuky“. Pre overenie značky preto vznikne samostatná verejne dostupná stránka `/prepojenie-gmailu/`, ktorú možno použiť ako domovskú stránku OAuth aplikácie. Nebude v reklamných cieľoch ani v SEO sitemap; jej účel je transparentnosť pre používateľa účtu a kontrolóra Google.
- Stránka musí presne uviesť jedinú funkciu: po superadminovom súhlase nájsť odoslanú firemnú kópiu ponuky podľa Message-ID a pridať zelený štítok a hviezdičku. Gmail API ponuku neodosiela, nečíta telo správy na účely evidencie a nesmie automaticky spracúvať nejednoznačné zhody.
- Viditeľné odkazy na existujúce zásady ochrany osobných údajov a podmienky používania budú mať rovnaké adresy ako v nastavení Google. Žiadne heslo Gmailu sa nezbiera.
- Google aktuálne označuje `gmail.modify` ako obmedzený rozsah. Oprávnenie je potrebné na označenie konkrétnej správy; jeho používateľský opis od Google je širší než reálna implementácia. Žiadosť musí vysvetliť tento rozdiel, obsahovať demo všetkých OAuth klientov a prípadné nezávislé bezpečnostné posúdenie sa rieši až po rozhodnutí Google. Bez overenia nevyhlasovať pripojenie za funkčné.
