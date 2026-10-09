# Lokálny release checkpoint `9a201efb` — 9. 10. 2026

Tento dokument sumarizuje iba lokálne dôkazy presného zdrojového kandidáta. Nie je dôkazom stagingového ani produkčného nasadenia a neoprávňuje vykonať cloudový zápis, formulár, e-mail alebo zmenu aliasu.

## Nemenná identita zdroja

- Commit: `9a201efbb68ed1c5b20c9e8c98d0166c2abe5cd2`
- Git tree: `8977d39f91204c8944a32388d3bec933a0fbad27`
- Vetva pri vytvorení dôkazu: `codex/astana-upgrade-rc1`
- Chránený baseline release guardu: `8b8775d05ca638d6a602829e7527b573be3321c9`
- Nemenný manifest: [LOCAL-BUILD-EVIDENCE-9a201efb.json](LOCAL-BUILD-EVIDENCE-9a201efb.json)

## Nemenný buildový a databázový dôkaz

| Kontrola | Výsledok |
|---|---:|
| MJS testy | 441/441 PASS |
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
| Aplikačný BUILD_ID | `v52jbGAehJS1qmatCfYgB` |
| Prístup k produkcii | `false` |
| Jednorazové databázy a vlastné dočasné rooty | zastavené a odstránené |

Produkčná databáza, SMTP ani skutočný Vercel Blob sa nepoužili.

## Aktuálny výkonový dôkaz S08

Lighthouse 13.5.0 bežal nad druhým čistým buildom toho istého Git tree. Päť trás bolo meraných trikrát, spolu **15/15 PASS**:

| Trasa | Performance | Accessibility | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|
| Homepage | 96 | 100 | 100 | 2 456 ms | 0 |
| Orientačná cena | 98 | 100 | 100 | 2 358 ms | 0 |
| Realizácie | 97 | 100 | 100 | 2 469 ms | 0 |
| Článok | 97 | 100 | 100 | 2 492 ms | 0 |
| Kariéra | 98 | 100 | 100 | 2 431 ms | 0 |

Lighthouse BUILD_ID bol `2cdbp66WMsLarQ_5zY8zz`. `productionAccess:false`; jednorazová databáza aj vlastné dočasné dáta boli odstránené. Všetkých pätnásť behov splnilo prahy Performance ≥ 90, Accessibility ≥ 90, SEO ≥ 90, LCP ≤ 2 500 ms a CLS ≤ 0,1.

## Nezávislá kontrola bezpečnostného rezu

Bezpečnostný diff scan identifikoval tri konkrétne obchádzania limitov cez klientom ovládateľné proxy hlavičky. Oprava zjednotila produkčnú identitu na Vercel-riadenú hlavičku, zachovala lokálny vývoj a presunula limit upload tokenu pred parsovanie tela bez účtovania podpísaného Blob callbacku. Prvý read-only kontrolór našiel jednu nízku chybu poradia; po oprave druhý nezávislý kontrolór vydal **PASS**. Cielené testy po oprave prešli 47/47.

## Hranice dôkazu

Lokálny PASS ešte nepreukazuje oddelené stagingové DB/Blob zdroje, stagingový deployment tohto SHA, reálne inboxy, skutočný Private Blob, prirodzené Vercel crony, produkčný rollback, produkčné Core Web Vitals, fyzický mobil/čítačku obrazovky, päť reálnych používateľov ani vlastnícke obchodné a realizačné dôkazy. Tieto body zostávajú samostatnými release bránami a formálne skóre projektu preto ostáva **63,6/100**.
