# G09 — produkčný dôkaz prístupu AI a vyhľadávacích botov

Dátum kontroly: 9. 10. 2026  
Prostredie: Vercel Firewall → Traffic, produkčný projekt `likvidacia-eternitu-sk`  
Režim: iba čítanie; bez zmeny pravidiel, Bot Protection, deploymentu, premenných alebo dát

## Pozorovanie

Vercel dashboard zobrazil rozsah **Past Day**, konkrétne `Oct 8, 1:37 - Oct 9, 1:37`, a host `likvidacia-eternitu.sk`. Súhrn za zobrazené obdobie uvádzal približne **2,4 tis. povolených**, **282 odmietnutých** a **22 challenge** požiadaviek.

Medzi piatimi najčastejšími user-agentmi boli:

| Identifikovaný user-agent | Počet požiadaviek |
|---|---:|
| `OAI-AdsBot/1.0` | 607 |
| `OAI-SearchBot/1.0` | 177 |
| `ChatGPT-User/1.0` | 109 |

Presný read-only firewall dotaz následne použil filtre `WAF Action is allow` a celý user-agent `OAI-SearchBot/1.0`, výsledok zoskupil podľa `Request Path` a zobrazil obdobie `Oct 8, 1:30 - Oct 9, 1:45`. Medzi skutočne povolenými požiadavkami tohto bota boli aj tieto verejné cesty:

| Verejná cesta | Povolené požiadavky OAI-SearchBot |
|---|---:|
| `/` | 6 |
| `/robots.txt` | 5 |

Samostatná aktuálna syntetická kontrola dostupnosti s user-agentom `OAI-SearchBot/1.0` vrátila pre domovskú stránku HTTP `200` a pre `robots.txt` HTTP `200`, bez presmerovania. Syntetická kontrola sa nepočíta ako návšteva skutočného OpenAI bota; overuje iba to, že rovnaký deklarovaný user-agent dnes nie je blokovaný a obe verejné cesty odpovedajú úspešne.

Panel zároveň zobrazil návštevnosť zo sietí Google LLC a Facebook, ale samotný názov siete nie je dôkazom konkrétneho crawlera. Tento záznam preto používa iba explicitne zobrazené OpenAI user-agenty. Predchádzajúci [GSC baseline](SEARCH-CONSOLE-BASELINE-2026-10-07.md) samostatne potvrdzuje Google vlastníctvo, úspešnú sitemap, indexáciu a dostupné agregované výsledky.

## Vyhodnotenie G09

Kritérium G09 vyžaduje dostupnosť OAI-SearchBot a relevantných vyhľadávačov vrátane dostupného firewall/log dôkazu a zaznamenanie dostupných GSC generatívnych údajov. Produkčný firewall preukazuje skutočné povolené požiadavky OAI-SearchBot na `/` a `/robots.txt`; aktuálna syntetická kontrola preukazuje úspešnú odpoveď oboch ciest s rovnakým user-agentom. Spolu s lokálnym robots/crawl kontraktom a existujúcim GSC baseline túto podmienku spĺňa. **G09 = PASS current production evidence.**

## Hranice dôkazu

- User-agent je identita deklarovaná požiadavkou; tento dashboardový pohľad sám nepotvrdzuje vlastníctvo každej zdrojovej IP.
- Firewall dotaz potvrdzuje konkrétne povolené cesty, nie historický HTTP response status každej požiadavky, indexáciu všetkých stránok, citovanie ani odporúčanie ASTANY. Stav `200` patrí samostatnej aktuálnej syntetickej kontrole.
- Bot Protection bol v čase kontroly zobrazený ako `Inactive`; nebolo menené žiadne firewall pravidlo.
- Dôkaz patrí aktuálnej živej produkcii. Nepotvrdzuje nasadenie zdrojového kandidáta `31157118`, staging ani post-release crawl S01/S09.
- Do dokumentu sa zámerne neukladajú IP adresy, tajomstvá ani osobné údaje.
