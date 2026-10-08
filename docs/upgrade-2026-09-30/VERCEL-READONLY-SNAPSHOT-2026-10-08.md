# Vercel read-only snapshot — 8. 10. 2026

## Rozsah a bezpečnostná hranica

Kontrola prebehla iba na čítanie cez prihlásené Vercel CLI. Nevytvoril sa deployment, nezmenil alias, premenná, databáza, Blob, cron ani oprávnenie. Hodnoty premenných sa nečítali, neukladali a tento dokument neobsahuje ich časti.

## Aktuálny živý stav

- Produkčný alias `likvidacia-eternitu.sk` smeruje na deployment `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` v stave **READY**, target **production**, vytvorený 4. 10. 2026 o 20:49 SELČ.
- Deployment má aj aliasy `www.likvidacia-eternitu.sk` a projektové Vercel aliasy.
- Vercel CLI pri tejto kontrole neposkytlo Git SHA. Predchádzajúci snapshot ho viazal na `c98c630c…`; dnešná kontrola potvrdzuje deployment a alias, nie zdrojovú zhodu.
- Aktuálny lokálny buildový checkpoint `c18f6f54` ani aplikačný kód `35867597` nie sú nasadené a produkcia zostáva **NOT VERIFIED** voči kandidátovi.

## Preview nie je staging

- Najnovší zobrazený Preview je `dpl_3N29jpHnqFQ4ML3nVVp5shyni2nn`, stav **READY**, vytvorený 5. 10. 2026 o 10:50 SELČ.
- Preview prostredie má priradené rovnaké názvy databázových, Blob a SMTP väzieb ako Production (`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, relay premenné).
- Chýbajú všetky vlastné stagingové väzby vyžadované aplikáciou: `STAGING_WRITE_ENABLED`, stabilná identita a marker staging DB, stagingové odtlačky DB/Blob, produkčné kontrolné odtlačky a jediný testovací príjemca.
- Preto bežný Preview nie je bezpečné zapisovateľné testovacie prostredie. Aplikácia ho správne blokuje fail-closed; nemožno na ňom vykonať dopyt, upload, CRM zápis ani e-mailovú akceptáciu.

## Produkčné konfiguračné medzery

| Oblasť | Stav | Dopad |
|---|---|---|
| `CONVERSION_EVENT_SECRET` | chýba | Lead sa môže bezpečne uložiť, ale serverová konverzia ostane fail-closed a nesmie sa vykazovať ako odoslaná. |
| `GOOGLE_MAPS_API_KEY` | chýba | Doprava v cenovej ponuke zostáva ručne editovateľná; automatický návrh kilometrov nie je dostupný. |
| retenčné opt-in a binding premenné pre leady/CV | chýbajú | Automatické mazanie zostáva bezpečne vypnuté, kým sa nedoloží správny store a retenčný režim. |
| `PHOTO_INTAKE_*` a `PHOTO_UPLOAD_SESSION_SECRET` | chýbajú | Tímový príjem fotografií zostáva bezpečne vypnutý. |
| citlivé integračné väzby DB/Blob | Vercel ich zobrazuje ako typ **Config** | Pred zmenou typu alebo rotáciou treba osobitne potvrdiť spôsob správy integrácie; hodnoty sa pri tejto kontrole neotvárali. |

## IAM a ochrana projektu

- Projekt používa Node.js 24.x a má zapnutú ochranu deploymentov z cudzích Git fork vetiev.
- Existuje automatizačný bypass, ale jeho identifikátor ani tajomstvo sa do dôkazov neukladajú.
- Príkaz na prehľad tímového prístupu skončil `not_authorized` s hlásením o nepodporovanom pláne. IAM preto zostáva **NOT VERIFIED**, nie PASS.

## Release rozhodnutie

1. Aktuálna produkcia sa nemení.
2. Najnovší Preview sa nesmie použiť na mutačné testy ani označiť za Staging.
3. Pred nasadením treba vytvoriť vlastné Vercel prostredie **Staging** s oddelenou DB, hlavným Private Blob, samostatným Private Blob pre tímové fotografie a jediným testovacím e-mailovým príjemcom.
4. Až po kryptografickom overení všetkých stagingových väzieb sa zopakujú testy dopytu bez fotografie a s fotografiou, inboxov, adminu, cronov a browser matice.
5. Produkčný deployment a ostrý formulárový smoke vyžadujú samostatný čerstvý súhlas používateľa.

Tento snapshot uzatvára iba čítaciu inventúru. Nevytvára staging, nemení Vercel a nie je produkčnou akceptáciou.

## Lokálna validácia snapshotu

- Nový kontrakt kontroluje oddelenie pojmov Production, Preview a Staging, presné deployment ID, otvorené konfiguračné medzery a neprítomnosť hodnoty tajomstva v tomto dôkaze.
- Celá sada po doplnení kontraktu prešla **394/394 MJS + 34/34 TypeScript testov**. Prvý sandboxovaný beh bol odmietnutý operačným systémom pri vytváraní dočasných Git repozitárov a štarte Edge; identická sada mimo tejto izolácie prešla bez chyby.
