# Lokálny release checkpoint `31157118` — 9. 10. 2026

Tento dokument sumarizuje iba lokálne dôkazy presného zdrojového kandidáta. Nie je dôkazom stagingového ani produkčného nasadenia a neoprávňuje vykonať cloudový zápis, formulár, e-mail alebo zmenu aliasu.

## Nemenná identita zdroja

- Commit: `31157118a05f9f903963f57182b957fe4e0347e9`
- Git tree: `f957ecb0edeb43fe927714e0440d7d6d990c8204`
- Vetva pri vytvorení dôkazu: `codex/astana-upgrade-rc1`
- Chránený baseline release guardu: `8b8775d05ca638d6a602829e7527b573be3321c9`
- Nemenný manifest: [LOCAL-BUILD-EVIDENCE-31157118.json](LOCAL-BUILD-EVIDENCE-31157118.json)

## Nemenný buildový a databázový dôkaz

| Kontrola | Výsledok |
|---|---:|
| MJS testy | 436/436 PASS |
| TypeScript testy | 35/35 PASS |
| Samostatná typová kontrola | PASS |
| Databázové integrácie | 13/13 PASS |
| Staging bootstrap | PASS |
| Meta consent race a CAPI outbox | PASS |
| PostgreSQL prevádzkové alarmy O06 | PASS |
| Produkčný Next.js build | 100/100 trás |
| Statické SEO metadata a obsah | 33/33 URL |
| Dynamické realizácie a recenzie | PASS |
| Route CSS/JS izolácia | PASS |
| Aplikačný BUILD_ID | `fc0sTa8dV7FOC8i_pwIAO` |
| Prístup k produkcii | `false` |
| Jednorazové databázy a vlastné dočasné rooty | zastavené a odstránené |

Produkčná databáza, SMTP ani skutočný Vercel Blob sa nepoužili.

## Aktuálny výkonový dôkaz S08

Lighthouse 13.5.0 bežal nad druhým čistým buildom toho istého Git tree. Päť trás bolo meraných trikrát, spolu **15/15 PASS**:

| Trasa | Performance | Accessibility | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|
| Homepage | 96 | 100 | 100 | 2 464 ms | 0 |
| Orientačná cena | 98 | 100 | 100 | 2 376 ms | 0 |
| Realizácie | 97 | 100 | 100 | 2 479 ms | 0 |
| Článok | 98 | 100 | 100 | 2 435 ms | 0 |
| Kariéra | 98 | 100 | 100 | 2 448 ms | 0 |

Lighthouse BUILD_ID bol `WumrPiz3b_54MDt2SYIOt`. `productionAccess:false`; jednorazová databáza aj vlastné dočasné dáta boli odstránené. Uchovaný beh Realizácií obsahuje jednotlivé LCP 2 546, 2 479 a 2 464 ms; rozhodujúci medián 2 479 ms splnil limit 2 500 ms. Celá uchovaná pätnásťbehová matica prešla bez zmeny zdroja.

## Nezávislá kontrola

Nezávislý read-only kontrolór neidentifikoval technický regres v uchovaných Lighthouse behoch, ale upozornil, že samostatný diagnostický report typu LCP prvku nie je súčasťou hashovaného balíka. Tento checkpoint preto z diagnostiky nevyvodzuje typ LCP prvku ani príčinu rozdielu. Samostatný review aktuálneho dôkazového parsera potvrdil fail-closed požiadavku presne 13/13 databázových testov a povinný PostgreSQL dôkaz O06.

## Hranice dôkazu

Lokálny PASS ešte nepreukazuje oddelené stagingové DB/Blob zdroje, stagingový deployment tohto SHA, reálne inboxy, skutočný Private Blob, prirodzené Vercel crony, produkčný rollback, produkčné Core Web Vitals, fyzický mobil/čítačku obrazovky, päť reálnych používateľov ani vlastnícke obchodné a realizačné dôkazy. Tieto body zostávajú samostatnými release bránami a formálne skóre projektu preto ostáva 61,1/100.
