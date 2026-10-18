# Prechod súkromného fotoúložiska na OIDC

## Zámer a hranice

Táto zmena odstraňuje dlhodobý read-write token z produkčného príjmu fotografií. Funkcie Vercelu majú používať krátkodobý, automaticky obnovovaný OIDC token a explicitný identifikátor dedikovaného súkromného Blob úložiska.

Zmena sa týka iba súkromných fotografií z terénu. Nemení verejný formulár dopytu, cenové ponuky, reklamy, meranie, všeobecné úložisko príloh ani pravidlá publikovania. Cenová ponuka sa naďalej nesmie odoslať bez schválenia administrátorom a fotografia sa naďalej nesmie zverejniť bez samostatného schválenia superadminom.

## Bezpečnostné rozhodnutia

1. Produkcia bude pripravená iba vtedy, keď má `VERCEL_OIDC_TOKEN`, `PHOTO_INTAKE_BLOB_RESOURCE_ID`, overený Private store, zapnutú retenciu a platný kontrolný podpis väzby.
2. Väzba úložiska nebude obsahovať alebo vyžadovať načítanie dlhodobého tokenu. Bude vytvorená z identity skutočného databázového endpointu bez prihlasovacích údajov a zo stabilných identifikátorov projektu, databázy a fotoúložiska. Zmena databázového endpointu preto príjem aj retenciu bezpečne vypne.
3. Pre lokálne a izolované integračné testy zostane explicitný statický token povolený iba mimo produkčného Vercelu. Produkčný Vercel s dlhodobým foto tokenom sa uzavrie.
4. Každá operácia nad fotografiami dostane explicitné poverenie a store ID. Ostatné Blob použitia projektu sa nemenia.
5. Existujúce pravidlá zostávajú: Private prístup, sanitizácia obrázka, retenčná fronta, superadmin kontrola a samostatné publikačné potvrdenie.

## Postup nasadenia

1. Aktualizovať `@vercel/blob` na verziu s OIDC podporou a prispôsobiť všetky operácie súkromného fotoúložiska.
2. Doplniť fail-closed testy pre produkčný OIDC režim, lokálny testovací fallback, nesprávny store a chýbajúci token.
3. Spustiť cielené testy, typecheck, produkčný build a nezávislú kontrolu diffu.
4. Až po výslovnom súhlase vlastníka povýšiť pripojenie konkrétneho Blob store na OIDC vo Verceli, aktualizovať kontrolný podpis a odstrániť dlhodobú premennú.
5. Vytvoriť kandidáta, overiť anonymný zákaz, prihlásenie do adminu, upload/retenciu bezpečným testom a nulové runtime chyby. Produkciu povýšiť až po úspešnom kandidátovi; pri regresii vrátiť predošlé nasadenie.

## Akceptácia

- produkčný runtime nevyžaduje `PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN`;
- produkčný runtime sa bez OIDC poverenia uzavrie;
- fotooperácie sú explicitne smerované do `PHOTO_INTAKE_BLOB_RESOURCE_ID`;
- súkromné fotografie nie sú anonymne čitateľné;
- retenčný worker vie objekt zmazať alebo bezpečne potvrdiť jeho neprítomnosť;
- upload, sanitizácia, interné schválenie a zverejnenie zostávajú oddelené;
- žiadna cenová ponuka ani fotografia sa neodošle/nepublikuje bez ľudského schválenia;
- nezávislý kontrolór vydá `PASS / ACCEPT` bez P0/P1/P2 nálezu.
