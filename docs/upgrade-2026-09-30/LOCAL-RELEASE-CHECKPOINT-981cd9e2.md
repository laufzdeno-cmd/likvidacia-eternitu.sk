# Lokálny release checkpoint `981cd9e2` — 8. 10. 2026

Tento dokument sumarizuje iba lokálne dôkazy presného zdrojového kandidáta. Nie je dôkazom stagingového ani produkčného nasadenia a neoprávňuje vykonať cloudový zápis, formulár, e-mail alebo zmenu aliasu.

## Nemenná identita zdroja

- Commit: `981cd9e2eb200a579f1c3eb705ee3bb6b95f83d1`
- Git tree: `3198f4d10255700c61a409ace6a7e3295a53ca8b`
- Vetva pri vytvorení dôkazu: `codex/astana-upgrade-rc1`
- Baseline release guardu: `8b8775d05ca638d6a602829e7527b573be3321c9`
- Nemenný manifest: [LOCAL-BUILD-EVIDENCE-981cd9e2.json](LOCAL-BUILD-EVIDENCE-981cd9e2.json)

## Nemenný buildový dôkaz

Manifest a jeho tri kanonicky hashované logy preukazujú:

| Kontrola | Výsledok |
|---|---:|
| MJS testy | 428/428 PASS |
| TypeScript testy | 35/35 PASS |
| Samostatná typová kontrola | PASS |
| Produkčný Next.js build | 100/100 trás |
| Statické SEO metadata URL | 33/33 |
| Statické SEO obsahové URL | 33/33 |
| Dynamické realizácie a recenzie | PASS |
| Route CSS/JS izolácia | PASS |
| BUILD_ID | `lWI95S1bOK2o9OCwQhuvJ` |
| Prístup k produkcii | `false` |
| Jednorazová PostgreSQL zastavená a odstránená | áno |
| Vlastný dočasný root odstránený | áno |

## Databázové integrácie

Samostatný beh `npm.cmd run test:db-integration` na tom istom zdroji prešiel **12/12** scenármi. Pokryl PostgreSQL/PGlite schému a migrácie, atomickú väzbu dopytu, súkromných príloh a outboxu, idempotenciu a rollback, cenové ponuky, TOTP a súbehy. Navyše prešli:

- transakčný a súbehovo bezpečný staging bootstrap,
- lokálny Meta consent create/revoke/tombstone race,
- izolovaný Meta CAPI outbox,
- fail-closed správanie bez produkčnej `DATABASE_URL`.

Produkčná databáza, SMTP ani skutočný Vercel Blob sa nepoužili.

## Aktuálny výkonový dôkaz S08

Na tom istom zdrojovom commite prešiel izolovaný produkčný build s PostgreSQL 17 a Lighthouse 13.5.0. Päť trás bolo meraných trikrát, spolu **15/15 PASS**:

| Trasa | Performance | Accessibility | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|
| Homepage | 96 | 100 | 100 | 2 475 ms | 0 |
| Orientačná cena | 98 | 100 | 100 | 2 365 ms | 0 |
| Realizácie | 97 | 100 | 100 | 2 474 ms | 0 |
| Článok | 98 | 100 | 100 | 2 443 ms | 0 |
| Kariéra | 98 | 100 | 100 | 2 445 ms | 0 |

Lighthouse BUILD_ID bol `xzZqqUE3ZYdFdTbEBYV3M`. `productionAccess:false`; jednorazová databáza aj vlastné dočasné dáta boli po behu odstránené. Rozdiel BUILD_ID oproti nemennému manifestu je očakávaný, pretože ide o samostatný čistý build toho istého Git tree.

## Nezávislá kontrola

Nezávislý read-only kontrolór presného rezu `981cd9e2` vydal **PASS**. Overil, že lokálny Meta test zostáva v `NODE_ENV=test` bez produkčnej DB, že produkcia bez `CONVERSION_EVENT_SECRET` zlyhá bezpečne, PGlite nevytvorí Meta outbox bez tajomstva a že test nevytvára lokálne JSON úložisko.

## Hranice dôkazu

Lokálne výsledky ešte nepreukazujú:

- oddelené a správne pripojené stagingové DB a dva Private Blob stores,
- konkrétny READY staging deployment presného SHA,
- dve skutočné fotografie nad 6 MB cez Vercel Private Blob,
- reálne doručenie do jediného stagingového inboxu a následne do oboch produkčných schránok,
- prirodzené behy Vercel cronov po promote a po rollbacku,
- produkčný rollback,
- produkčné Core Web Vitals,
- finálnu Chrome/Opera/fyzický mobil/čítačka obrazovky maticu,
- výsledok piatich reálnych používateľov,
- vlastnícke potvrdenie obchodných predpokladov a dôkazov realizácií.

Tieto body zostávajú samostatnými release bránami. Ich stav sa nesmie odvodiť z lokálneho PASS.
