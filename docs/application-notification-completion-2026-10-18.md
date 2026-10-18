# Dokončenie kariérnych notifikácií — 18. 10. 2026

## Zámer

Kariérna žiadosť musí byť prijatá iba raz a musí vytvoriť dva nezávisle sledované emaily: potvrdenie uchádzačovi a interné upozornenie ASTANA. Systém smie automaticky zopakovať iba jednoznačne retryable SMTP zlyhanie. Neznámy výsledok sa nesmie automaticky odoslať znova.

## Overený problém

- Produkčný endpoint `https://www.astana.sk/_internal/lead-relay` už neprijíma `POST` a vracia HTTP 405.
- Štyri kariérne žiadosti preto vytvorili osem stavov `unknown` — vždy dvojicu uchádzač + ASTANA.
- Priamy produkčný SMTP transport je funkčný: posledných 28 sledovaných dopytových emailov má stav `sent`, platné message ID a žiadnu chybu.

## Rozhodnutie

1. Kariérne emaily sa presunú zo zastaraného relaya na existujúci priamy SMTP transport.
2. Každý príjemca dostane samostatný claim, výsledok a message ID.
3. Retry jedného príjemcu nebude znovu odosielať už potvrdený email druhému príjemcovi.
4. Uchádzač dostane profesionálny slovenský HTML email s logom ASTANA a textovú alternatívu.
5. Interný email bude odkazovať na chránený detail žiadosti; životopis sa nebude sprístupňovať verejne ani prikladať mimo schváleného toku.
6. Staré stavy `unknown` zostanú bez automatického opakovania. Uzavrú sa iba po dôkaze zo schránky alebo od poskytovateľa.

## Bezpečnostné hranice

- Cenové ponuky ostávajú pod ľudským schválením.
- Fotografie a životopisy ostávajú súkromné.
- Server Actions overujú CSRF, rolu, identifikátor, stav a povolený dôkaz.
- Produkčné tajomstvá sa nezapisujú do repozitára ani do dočasných súborov.
- Testy nesmú odoslať reálny email ani vytvoriť verejnú referenciu.

## Akceptácia

- unit/contract testy pre obsah, escaping, per-recipient claim a retry,
- produkčný build,
- nový kandidát bez okamžitého prepnutia domény,
- release guard a rollback,
- po nasadení prirodzený cron bez 5xx pre nové stavy,
- starý backlog zostane viditeľný, kým ho človek neuzavrie dôkazom.
