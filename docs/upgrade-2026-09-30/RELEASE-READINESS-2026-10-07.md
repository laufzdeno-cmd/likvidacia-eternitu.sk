# Release readiness — read-only produkčný snapshot 7. 10. 2026

## Rozsah kontroly

Kontrola bola iba na čítanie. Nebol vytvorený deployment, zmenený alias, upravená premenná, odoslaný formulár, otvorený zákaznícky súbor ani odhalená hodnota tajomstva.

## Živý stav

- Aktuálny produkčný deployment `FYaPKy6tk` je **Ready**, **Current**, vznikol 4. 10. 2026 a Vercel ho viaže na vetvu `codex/private-photo-upload`.
- Tento deployment neobsahuje lokálny aplikačný checkpoint `3e8011f0` ani dokumentačný checkpoint `0fdd3f8f`.
- Za posledných 30 minút Vercel pri tomto deploymente zobrazoval 0 warning, 0 error a 0 fatal záznamov. Krátke okno nenahrádza produkčný monitoring ani post-release smoke.
- Produkčný HTTPS a `www` používajú trvalé presmerovanie na kanonický host; kontrolované hlavné trasy vracajú 200 a neexistujúca cesta 404.

## Preukázané odchýlky starej produkcie

- Homepage stále publikuje obchodný prísľub dopravy zdarma nad určitú výmeru. Kandidát používa pravdivé pravidlo, že prípadná doprava je samostatne uvedená v cenovej ponuke.
- Homepage stále opisuje rozhodnutie RÚVZ ku konkrétnej stavbe. Kandidát vysvetľuje aktuálny oznamovací režim bez predstierania individuálneho povolenia.
- `/kde-posobime/` je v starej produkcii 404 a `/pre-strecharov/` je duplicitná indexovateľná 200 stránka; kandidát má celoslovenský hub a kanonické presmerovanie na `/strechari/`.
- Produkčná sitemap používa jeden rovnaký nedoložený `lastmod` pre všetky URL; kandidát tieto dátumy nevymýšľa.
- Produkčný robots.txt ešte nemá úplné pravidlá kandidáta pre AI botov a zákaz `/api/`.

## Vercel konfiguračný kontrakt

Overené boli iba názvy, prostredia a typ premenných, nikdy nie ich hodnoty.

- `GOOGLE_MAPS_API_KEY` chýba. Cenová ponuka ostáva bezpečne funkčná s ručne editovateľnými kilometrami, automatický výpočet trasy však nebude dostupný.
- `CONVERSION_EVENT_SECRET` chýba. Nový konverzný outbox ostane fail-closed a nesmie predstierať odoslanie Meta konverzie.
- Všetky `PHOTO_INTAKE_*` premenné aj `PHOTO_UPLOAD_SESSION_SECRET` chýbajú. Nový tímový foto-intake preto ostane bezpečne vypnutý.
- Retenčné prepínače a väzby pre prílohy, CV a tímové fotografie chýbajú. Mazanie sa nesmie zapnúť bez inventarizácie a presného projektu/DB/store bindingu.
- `DATABASE_URL` aj `BLOB_READ_WRITE_TOKEN` sú vo Verceli uložené ako **Config** a Vercel ich označuje `Needs Attention`; pred release ich treba bezpečne previesť na **Secret** bez zmeny hodnoty.
- Existujúci store `astana-lead-files-prod` je **Private**, je pripojený k projektu pre Production, Preview aj Development a obsahuje približne 77,2 MB. Jeho firewall je označený **Not Protected**; ochranu projektu treba zapnúť iba ako osobitne schválenú zmenu prístupu.

## Bezpečný ďalší krok

1. S výslovným súhlasom upraviť iba Vercel bezpečnostnú konfiguráciu a chýbajúce tajomstvá; hodnoty nevypisovať do chatu ani logov.
2. Vytvoriť staged **production** deployment s `--skip-domain`, nie preview a nie živý alias.
3. Na presnom staged deploymente zopakovať build/route smoke, admin prihlásenie, súkromný Blob a označený test dopytu bez fotografie aj s fotografiou do oboch schránok.
4. Až po úspešnom nezávislom re-review a samostatnom súhlase povýšiť presne overený deployment na produkčný alias.
5. Ihneď po povýšení overiť kanonický host, sitemap, robots, právny a dopravný text, formulár, inboxy, Chrome/Opera a fyzický mobil. Pri odchýlke použiť vopred overený rollback deployment.
