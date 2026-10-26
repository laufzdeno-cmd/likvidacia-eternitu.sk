# Praktické rozšírenie administrácie — 26. 10. 2026

## Rozhodnutie

Porovnanie s administráciou ASTANA.sk ukázalo viacero nápadov, ale do projektu sa majú dostať iba funkcie, ktoré znižujú každodennú prácu bez vytvorenia druhého paralelného CRM alebo rizikového publikačného systému.

Implementačný balík obsahuje tri funkcie:

1. **Klienti** — odvodený prehľad opakovaných zákazníkov z existujúcich dopytov, zákaziek a ponúk. Nevytvára druhú kópiu osobných údajov.
2. **Knižnica médií** — prehľad už prijatých fotografií, ich schválenia a použitia v konceptoch realizácií. Nemení existujúci dvojstupňový publikačný proces.
3. **História verzií obsahu** — uložené snímky textov úvodnej stránky a kontrolovaná obnova staršej verzie superadminom.

## Čo sa zámerne neimplementuje

- **Dynamická správa presmerovaní:** Next.js Proxy nemá vykonávať pomalé databázové čítanie pri každej verejnej požiadavke. Existujúce presmerovania zostávajú verzované a kontrolované pri release.
- **Editovanie firemných údajov z adminu:** verejné firemné údaje sú súčasťou statického zdroja pravdy, JSON-LD a strojových výstupov. Priame databázové prepísanie by mohlo vytvoriť rozpor a oslabiť SEO.
- **Samostatné objednávky, sklad, jednotky, kraje a voľné stavy:** pre tento projekt by duplikovali existujúce zákazky alebo narušili automatizovaný workflow.
- **SMS odosielanie:** bez potvrdeného poskytovateľa, cien, súhlasov a reálneho procesu by išlo o technický dlh.

## Bezpečnostné a produktové hranice

- Cenová ponuka sa naďalej nikdy neodošle bez ľudského schválenia.
- Klientsky prehľad iba zobrazuje existujúce údaje a nevykonáva automatické spájanie záznamov.
- Knižnica médií je iba pre superadmina. Fotografie zostávajú súkromné a na web sa dostanú až po existujúcej druhej kontrole prípadu.
- Obnova obsahu je Server Action s CSRF, opätovným overením roly superadmina, kontrolou platnej verzie a auditným záznamom.
- História obsahu neobsahuje heslá, tokeny ani osobné údaje zákazníkov.
- Verejné stránky a SEO dáta sa nemenia mimo už existujúcich editovateľných textov homepage.

## Dátový model

### Klienti

Prehľad sa počíta z existujúcich záznamov. Normalizovaný kľúč používa prioritne e-mail, potom telefón a napokon samostatný identifikátor dopytu. V adrese stránky sa používa iba UUID reprezentatívneho dopytu, nikdy e-mail ani telefón.

### Médiá

Používa existujúce tabuľky `realization_media_intake`, `photo_upload_invites`, `realization_case_draft_media` a `realization_case_drafts`. Nezakladá druhé úložisko ani verejnú kópiu originálu.

### Verzie obsahu

Nová tabuľka `site_content_versions` uloží úplnú snímku povolených textových kľúčov, autora, čas, typ operácie a kryptografický odtlačok. Obnova vytvorí novú verziu; starú históriu nikdy neprepisuje ani nemaže.

## Oprávnenia

- **Operátor:** vidí Klientov a môže otvoriť existujúce dopyty, zákazky a ponuky.
- **Superadmin:** navyše vidí Knižnicu médií, Históriu obsahu a môže obnoviť staršiu verziu.
- **Kontrolór Meta:** naďalej vidí iba Facebook správy.

## Akceptačné podmienky

- Žiadne osobné údaje zákazníka sa nepridajú do URL alebo klientského JavaScriptu nad rozsah potrebný pre zobrazenie.
- Zoznam klientov zoskupí opakované dopyty bez automatického zlúčenia alebo vymazania.
- Knižnica médií ukáže stav, približnú lokalitu, kategórie, väzbu na zákazku a použitie v konceptoch.
- Neschválená fotografia sa nedá zameniť za verejne publikovateľnú.
- Uloženie textov vytvorí verziu a obnova vytvorí ďalšiu auditovateľnú verziu.
- Každá Server Action vykoná vlastnú autentifikáciu, autorizáciu, CSRF a validáciu vstupu.
- TypeScript kontrola, relevantné testy a produkčný build musia prejsť pred vytvorením release kandidáta.
