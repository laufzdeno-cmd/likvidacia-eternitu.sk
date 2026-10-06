# E8 — aktuálny stav kandidáta a release brány

> Historický kontrolný bod pri `f1be6b74`, nie dnešná identita kandidáta. Najnovší stav je v datovanom dodatku [E8-RELEASE-INVENTORY.md](E8-RELEASE-INVENTORY.md): čistý lokálny kandidát `8a4a9386`, stále **NOT READY** pre produkčné vydanie.

Kontrolný bod: 2. 10. 2026 (Europe/Bratislava). Read-only kontrola; nič sa nestagovalo, nemenilo v reklamách, neposielalo ani nenasadzovalo.

## Jednoznačná identita kontrolovaných stromov

| Strom | Vetva / HEAD | Pracovný strom | Záver |
|---|---|---:|---|
| Hlavný checkout `C:\WEB\DIGITAL24.sk\likvidacia-eternitu.sk` | `main` / `3f48aee589dba53041d78a26df4561e4f1bd22c4` | 244 položiek: 85 sledovaných zmien, 159 nesledovaných | Rozpracovaný WIP; nie release kandidát |
| `artifacts/e8-candidate-20261002` — posledná kontrola | `codex/e8-candidate-20261002` / `f1be6b74275d5cc424f25c110ac32ec825260802`; tree `867fb8b6c860c6ac01898a15446375ae2e14e015` | 722 sledovaných; pri jednom čítaní bola zmena `next-env.d.ts`, pri poslednom checku čisté; 0 nesledovaných | Commit je identifikovateľný; celkovo nezávisle prijatým release zatiaľ nie je |

Bezprostredne pred uzavretím mal kandidát HEAD `320f60f7` (rodič `9c26fae3`) a 21 necommitnutých položiek. Tieto zmeny boli následne commitnuté ako `f1be6b74` s rodičom `320f60f7`. Worktree bol pri dvoch kontrolných bodoch čistý; medzi nimi sa raz objavila zmena `next-env.d.ts` na `.next/dev/types/routes.d.ts`, pri poslednej kontrole už nie. Pôvod tejto prechodnej zmeny nebol potvrdený. Staršie testy a úzke GPT schválenia sa stále dedia len na presné SHA/diffy, na ktoré sa vzťahujú. Hlavný WIP má samostatný HEAD a odlišný obsah; nemožno ich zamieňať.

Nezávislý GPT review navyše zistil, že historický `STATUS.md` uvádza manifest s 714 súbormi, kým inventár uvádza 720 sledovaných/723 fyzických pri inom kontrolnom bode. Bez manifestu s jasným SHA-256, koreňom, pravidlami zahrnutia a checkpointom sa tieto počty nesmú porovnávať ani používať ako dôkaz dnešného balíka. To nie je dôkaz poškodeného súboru; je to chýbajúca väzba obsahu a dôkazov.

## Čo možno a nemožno tvrdiť

- Lokálne testy, ktoré inventár viaže na SHA `320f60f7`, sú historickým dôkazom daného commitnutého zdroja. Aktuálny dirty stav na tej vetve tým nie je pokrytý.
- Vercel Preview nie je preukázateľne oddelený od produkčnej Neon DB/Blob. Preview je preto iba na čítanie a vizuálne kontroly; žiadne mutujúce formuláre, uploady, admin zápisy ani cron testy.
- Produkčný alias podľa posledného zdokumentovaného čítacieho dôkazu smeroval na deployment `83DhtcH4sysdBd8zfgEWMRmRvCE7`. Pred akýmkoľvek release rozhodnutím sa musí aktuálny alias znova overiť; pracovné zmeny nie sú nasadené.
- Skutočné doručenie dopytových e-mailov, upload veľkých príloh do produkčného Private Blobu, produkčné DB väzby a bezpečný retry neboli potvrdené end-to-end. Lokálne simulácie ich nenahrádzajú.
- SEO/GEO skóre celého finálneho buildu, ľudský mobilný test a celý panel AI otázok nie sú týmto kontrolným bodom prijaté. Odporúčanie AI nie je garantovateľný výsledok; merateľným cieľom je správnosť faktov, indexovateľnosť, citovateľné dôkazy a opakovaný panel.

## Jednotná matica projektu

`PROVEN` tu znamená iba lokálny dôkaz pri uvedenom SHA, nie produkčné prijatie. Neznáme zostáva otvorené, nie PASS.

| Etapa | Stav podľa aktuálnych dôkazov | Čo ešte treba uzavrieť |
|---|---|---|
| E0 — plán a akceptácia | Plán a binárne scorecardy existujú; používateľ plán výslovne schválil. | Pripnúť všetky dôkazy k jednému výslednému manifestu; nemaľovať cieľové skóre za dnešné skóre. |
| E1 — dopyty, uploady, doručovanie | Kandidát `f1be` má lokálne testy formulára/DB a isolated build podľa inventára. | Preview DB/Blob izolácia, starý klient a veľké reálne uploady, CRM/dopytová väzba, doručenie interného aj zákazníckeho mailu a bezpečné riešenie `unknown`. Bez toho formulár neoznačiť za produkčne overený. |
| E2 — CRM, admin, referencie | Zmeny dashboardu a klasifikácie testovacích záznamov sú v `f1be`; narrow review a lokálne testy sú zdokumentované. | Celá administrátorská matica na jednom candidate SHA, vrátane editácie/publikovania a kontroly prístupov; úplné ekonomické dáta majiteľa pre ziskovosť. |
| E3 — SEO a GEO crawl | Staršie crawl/metadáta testy existujú. | Opraviť/konfigurovať audítor tak, aby kontroloval artefakt vytvorený z presného kandidáta (nie starý koreňový `.next`); zmerať všetky URL, canonical/schema/sitemap/robots aj reálne konzoly. |
| E4 — UX a responzivita | Predošlé lokálne screenshot/testy pokrývali 320–1440 px a navigačné stavy. | Potvrdiť ich presnú väzbu na `f1be`; reálny používateľský test 4/5 a skutočné iOS/Android zariadenia, ak sú dostupné. |
| E5 — realizácie a mapa | Foto-intake, lokalita/kategória, koncept prípadu a publikačná brána sú implementované v kandidátovom kóde. | Izolované súkromné úložisko a retencia, end-to-end upload/read/delete, práva a ľudské potvrdenie lokality/fotiek; až potom prípadne publikovať. Žiadne GPS z EXIF automaticky nezverejňovať. |
| E6 — firemné fakty a dôveryhodnosť | Obsahová mapa a register tvrdení existujú. | Majiteľ/odborný garant potvrdí oprávnenia, cenu/DPH, históriu, kontakty a verejné prípady; dodá originálne fotky a súhlasy. Nepridávať vymyslené dôkazy. |
| E7 — platené vstupy a meranie | Lokálna consent-aware udalosť existuje; read-only Ads snímky a obmedzenia sú zaznamenané. | Overiť konečné URL/suffix každej aktívnej kampane, súhlas, produkčné ID/label a skutočný prijímač/atribúciu; bez úprav rozpočtu či kampaní. |
| E8 — release | `f1be` je určený commit/tree; širšie hodnotenie je **NOT READY**. | Čistý worktree/manifest, jedno aktualizované GPT review, bezpečné preview/prod stage, rollback a oprávnený produkčný smoke. Bez reálneho inbox dôkazu sa doručenie neuzavrie. |

Otvorené externé vstupy: (1) databázová/Blob izolácia pre testy, (2) aktuálna produkčná konfigurácia a Vercel staged-release možnosť, (3) majiteľove právne/cenové podklady a originálne fotografie so súhlasmi, (4) dostupnosť reálnych mobilných testerov a Search Console/Ads účtov. Kódové a auditné kroky pokračujú bez čakania na fotografie; ich publikovanie nie.

## Najbezpečnejšie pokračovanie

1. Zachovať oba existujúce stromy bezo zmien. Nevykonať reset, clean, cherry-pick ani hromadné kopírovanie.
2. Použiť existujúci commit `f1be6b74275d5cc424f25c110ac32ec825260802`, nie vytvárať ďalší kandidát ani znova vyberať obsah. Nad presným Git archívom tohto commitu bol vypočítaný SHA-256 `6808fa6d74672cec0ba710000e13777d81a24380e5af646dc601e5d0063e54cb` (137 840 640 bajtov; archív obsahuje 722 sledovaných súborov). Git tree je `867fb8b6c860c6ac01898a15446375ae2e14e015`. To viaže sledovaný zdroj k jednému obsahu, **nie je to manifest Vercel uploadu**.
3. Jednotná [stavová matica E8](E8-ACCEPTANCE-MATRIX.md) je vytvorená pre S/G/F/U/O kritériá. Jej `PASS (local)` je výslovne oddelený od produkčného prijatia; predchádzajúce testy sa pripisujú iba presnému SHA a prostrediu z inventára.
4. Pred mutačným Preview testom preukázať izoláciu DB aj Blob. Vercel zatiaľ nepreukázal oddelenú Preview DB/Blob, preto zostáva Preview iba na read-only/vizuálne kontroly.
5. Vyžiadať jedno nezávislé review presnosti matice a potom pokračovať iba v konkrétnych otvorených integračných bunkách. Produkciu, reálny lead a e-mail testovať až v oprávnenom release kroku.

**Verdikt:** pôvodný dirty checkpoint `320f60f7 + 21 položiek` bol `RETURN / NOT READY`. Nový čistý `f1be6b74` odstraňuje neistotu identifikácie a je kandidátom na kompletné review; zatiaľ však nemá celkové E8 prijatie, produkčný preview/delivery dôkaz ani uzavreté hardgates. Nie je to tvrdenie, že všetky lokálne funkcie zlyhávajú.
