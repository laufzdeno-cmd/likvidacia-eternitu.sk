# Zosúladenie lokálneho kandidáta s `origin/main`

Dátum kontroly: 8. 10. 2026 (Europe/Bratislava)

Obsahový checkpoint zosúladenia je `4d0b6bfbe6597a8bbdfb67a4101922ee35e8c387`, Git tree `8e5ac8cc61b7d40a4b3ed82b5274210af0dacf73`. Porovnanie začalo na lokálnom základe `9fbe758f`; opravy medzier sú v `4d0b6bfb`. Kontrolovaný merge ancestry vznikol v `e539ee5b` proti `origin/main` na commite `d314826537c6b94cb019164fc19140d10a014669`: jeho strom `d2087a49eff288f31c5cbab6f10ad6c0fb8ad7c3` je presne rovnaký ako strom prvého rodiča, takže merge nezmenil prijatý obsah. Na tomto merge checkpointe bol obojstranný rozdiel 85 commitov iba v kandidátovi a 0 iba na `origin/main`; na neskoršom QA checkpointe `439f75dc` je to 87 a 0. Kontrola bola zdrojová a lokálna. Produkcia, Vercel alias, živé formuláre, schránky, Blob ani reklamné účty sa nepoužili.

## Metóda

Každý z 24 commitov dostupných iba na `origin/main` bol porovnaný so súčasným stromom po súboroch a podľa výsledného správania. Verdikt:

- **zachované** — rovnaké správanie je v kandidátovi priamo,
- **nahradené novším riešením** — pôvodný zámer je pokrytý bezpečnejšou alebo širšou implementáciou,
- **opravená medzera** — kontrola našla chýbajúcu kompatibilitu a tá bola doplnená v `4d0b6bfb`,
- **zámerne neobnovené** — pôvodný text alebo dôkaz nebol dostatočne podložený.

## Výsledok po commitoch

| Commit z `origin/main` | Verdikt | Aktuálne riešenie |
|---|---|---|
| `d3148265` CRM väzba dopytov | nahradené novším riešením | Dopyt, zákazka, ponuka, klasifikácia a reporty používajú novší auditovateľný životný cyklus. |
| `b8dc2542` produkčný source attest | nahradené novším riešením | Kandidát má novšie nemenné lokálne checkpointy a release guard; starý produkčný attest sa neprenáša na nový zdroj. |
| `691dba1b` zdroj a testovací harness | nahradené novším riešením | Izolovaný PostgreSQL runner, build a browser harness sú novšie a prísnejšie. |
| `b97d6cdb` povinná približná výmera | zachované | Verejný formulár vyžaduje kladnú výmeru; historický sentinel sa spracúva osobitne. |
| `88f8d402` materiál z kampane | nahradené novším riešením | Aktuálny prefill povoľuje iba schválené aliasy a nemení kontakty ani súhlas. |
| `e1f9d013` V5 browser fixture | nahradené novším riešením | Súčasné kontrakty a browser testy používajú aktuálne verejné popisy. |
| `c54883c1` neplatné submission ID | nahradené novším riešením | Aktuálna validácia UUID, idempotencia a konflikt payloadu sú prísnejšie. |
| `acb577a5` V5 cleanup | opravená medzera | Historické `lead_area_unknown` sa už nezobrazuje ako `0 m²` v e-mailoch, CRM ani tvorbe ponuky; relay prenáša aj významový príznak a text. |
| `78b0d440` mobilný produkčný baseline | nahradené novším dôkazom | Novšie responzívne a izolované build dôkazy sú viazané na novšie checkpointy; starý produkčný baseline ostáva historický. |
| `78fee8ec` Android auto-dark | zachované | Ochranné farebné pravidlá zostali v aktuálnom vizuálnom systéme. |
| `8e70821c` lead regresie a release guard | nahradené novším riešením | Release guard a lead-form kontrakty sú širšie a fail-closed. |
| `ff1a059c` firemné štatistiky | čiastočne nahradené; nepodložené tvrdenia neobnovené | Overené firemné fakty zostali; tvrdenia o 300 000 m² a 2 000 klientoch sa bez dôkazu nepublikujú. |
| `fb96ba39` AI dôkazové plochy | opravená medzera | Dáta sú na `/o-firme/`, v `company.json` a `llms.txt`; stará `/overene-informacie/` má trvalé 308 presmerovanie. |
| `6f7774f2` vypnuté automatické Git deploye | zachované | Automatické Git nasadenie zostáva vypnuté; release je samostatne strážený. |
| `be825e31` ochrany formulára | nahradené novším riešením | Zachované sú stabilné submission ID, 30-sekundový timeout, jedno odoslanie, súkromné priame uploady a bezpečná obnova. |
| `7a99a62b` odstránenie Meta test eventu | zachované | Aktuálny transport neposiela do Meta dočasný testovací kód. |
| `086b79c3` consent QA deploy trigger | bez zdrojovej zmeny na obnovenie | Historický deployment trigger nie je súčasťou aplikačného správania. |
| `cc418c90` opätovné povolenie marketingu | opravená medzera | Najnovšia voľba medzi kartami má prednosť, revokácie sú viazané na subjekt a blokované úložisko zlyhá bezpečne so súhlasom vypnutým. |
| `90260d79` bezpečné CAPI kódy | nahradené novším riešením | Aktuálny outbox uchováva iba povolené bezpečné výsledky a odlišuje zlyhanie od neistoty. |
| `d32030dc` bezpečné logovanie CAPI | nahradené novším riešením | Logy a administrácia nezverejňujú kontakty ani surové provider odpovede. |
| `9488f138` dynamický runtime | zachované | Dynamické trasy prešli aktuálnym izolovaným produkčným buildom. |
| `999ac848` prenositeľné CTA presmerovanie | zachované | Aktuálne presmerovania sú relatívne alebo pevne same-origin. |
| `9a41826b` Facebook transition | nahradené novším riešením | Prechod zachováva iba ohraničené schválené atribučné polia a odmieta nebezpečné hodnoty. |
| `a9a12714` consent-gated CAPI outbox | nahradené novším riešením | Outbox je atómový s prijatým leadom, pseudonymný, revokovateľný a má izolované race/retry testy. |

## Akceptačné dôkazy opráv medzier

- Cielené kompatibilitné testy: **41/41 PASS**.
- Celá jednotková/kontraktná sada: **388/388 MJS + 34/34 TypeScript PASS**.
- Databázové integrácie: **12/12 PASS**, Meta consent race a CAPI outbox integračné scenáre PASS.
- Izolovaný Next.js 16.4.0 produkčný build: **99/99 trás PASS**, 32 statických SEO URL a obe dynamické verejné trasy PASS, `productionAccess:false`.
- Dvaja nezávislí read-only kontrolóri: **PASS** po odstránení všetkých nálezov v tomto reze.
- Bezpečnostný diff scan `d990c521-b0be-4715-b5c3-86acc272a126`: 20 zmenených súborov, úplné pokrytie, **0 nálezov**.

## Zostávajúca Git a release hranica

Obsahových 24 commitov je semanticky aj historicky zosúladených. Kontrolovaný merge `e539ee5b` zachoval presne strom prvého rodiča a `origin/main` je jeho predkom. Testy release guardu po merge prešli 12/12. Samotný ostrý release guard sa zámerne nespúšťal: vyžaduje aktuálne potvrdenie Vercel IAM a presné schválené argumenty kandidátskeho aj rollback deploymentu. Toto nie je oprávnenie na produkčný deploy.

Stále otvorené externé brány: aktuálny Vercel/IAM a staged release, skutočné doručenie oboch e-mailov, živý formulár bez/s fotografiou, súkromný Blob, fyzické Chrome/Opera/mobilné zariadenie, GSC/Bing/GBP a majiteľom potvrdené firemné/právne/cenové dôkazy a verejné realizácie.
