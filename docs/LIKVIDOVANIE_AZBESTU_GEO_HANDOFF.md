# GEO a AI dôveryhodnosť: handoff pre likvidovanie-azbestu.sk

## Účel druhej domény

Tento web nemá kopírovať obsah ani konverznú úlohu likvidacia-eternitu.sk. Pred publikovaním každej URL treba rozhodnúť, či prináša samostatný úmysel návštevníka a vlastnú hodnotu.

| Úmysel návštevníka | Primárna doména | Úloha druhej domény |
| --- | --- | --- |
| Cenová ponuka pre eternitovú strechu | likvidacia-eternitu.sk | Iba kontextový odkaz, nie duplikát |
| Postup, dokumentácia a bezpečné nakladanie s azbestom | likvidovanie-azbestu.sk | Praktické vysvetlenie s vlastným obsahom |
| Firemná identita ASTANA | Jeden kanonický firemný zdroj | Odkaz na zdroj, nie druhá protichodná verzia |

Ak URL nemá vlastný search intent, reálny obsah a vlastnú konverznú úlohu, zvoliť merge, noindex alebo odstránenie. Nesmie vzniknúť rovnaká stránka s vymeneným H1.

## Povinné hranice dôveryhodnosti

- Nepísať najlepšia, najlacnejšia, certifikovaná, hodnotenia ani hviezdičky bez verejného nezávislého dôkazu.
- Neprenášať automaticky štatistiky, realizácie, fotografie, lokality ani sľuby z likvidacia-eternitu.sk.
- Každý údaj musí mať pre tento web zdroj, dátum kontroly a jasný stav: údaj uvádzaný firmou alebo nezávisle overiteľný údaj.
- Nezverejňovať interné oprávnenia, čísla dokumentov, PDF oprávnení ani klientské dáta.
- Verejné crawlery môžu vidieť iba verejný obsah. Admin, API, uploady a súkromné dokumenty musia zostať chránené.
- Nemeníť formuláre, kampane, tracking, consent ani API bez samostatnej QA brány a mapy platených cieľových URL.

## Verejný dôkazový systém

Vytvoriť viditeľnú stránku Overené informácie, nie skrytú stránku iba pre AI. Má obsahovať:

1. Jeden H1 a priamu odpoveď v úvode.
2. Právnu identitu, IČO, sídlo, telefón, e-mail a pôsobnosť.
3. Odkaz na verejné overenie oprávnenia cez ÚVZ SR, ak je rozsah potvrdený.
4. Vysvetlenie postupu, nakladania s odpadom a dokladu po práci.
5. Transparentné pravidlá pre fotografie a recenzie.
6. Dátum obsahovej kontroly.
7. Samostatný blok Čo netvrdíme bez dôkazu.
8. Odkaz na ľudsky čitateľné zdroje aj strojové verejné dáta.

Použiť AboutPage, BreadcrumbList a FAQPage iba pri obsahu, ktorý je na stránke priamo viditeľný. Nepridávať Review, AggregateRating, hasCredential ani čísla oprávnení bez potvrdených podkladov a platnej schémy.

## Jeden zdroj firemných faktov

Vytvoriť jeden obsahový zdroj pre právny názov, IČO, adresu, kontakt, pôsobnosť, stav recenzií a potvrdené firemné údaje. Z neho majú čítať footer, kontakt, JSON-LD, dôveryhodnostná stránka, verejné company JSON aj llms.txt.

Pri každom čísle evidovať:

- kto údaj potvrdil,
- dátum kontroly,
- či ide o údaj uvádzaný firmou alebo nezávisle overiteľný údaj,
- verejný zdroj, ak existuje,
- hranicu tvrdenia.

## Crawl politika

V robots povoliť verejný obsah pre Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, ClaudeBot, PerplexityBot, Perplexity-User, Applebot, CCBot a zdieľacie crawlery.

GPTBot a Google-Extended možno povoliť, ak je cieľom širšia otvorenosť, ale neprezentovať ich ako podmienku pre ChatGPT Search alebo Google Search. OAI-SearchBot je relevantný pre dostupnosť obsahu v ChatGPT Search. Google Search sa opiera o bežný index a klasické SEO; llms.txt nie je Google ranking faktor.

Každému explicitnému crawleru zakázať admin a API. Ak WAF blokuje legitímne boty, najprv overiť skutočné HTTP správanie a podľa oficiálnych dokumentácií poskytovateľa použiť bezpečné overenie identity, nie plošné otvorenie ochrany.

## Obsah a technické overenie

- Každá hlavná stránka odpovie v prvých dvoch vetách na hlavný praktický dotaz.
- Evidencia, postup a cena musia byť v SSR HTML.
- Každá indexovateľná URL má jeden H1, unikátny title a description, self-canonical a zmysluplné interné odkazy.
- Sitemap obsahuje iba indexovateľné kanonické URL.
- JSON-LD musí byť syntakticky platný a zodpovedať viditeľnému obsahu.
- Verejné dáta a llms.txt musia odlišovať firemné tvrdenie od nezávislého zdroja.

## Dôkazy, ktoré treba doplniť majiteľom

1. Verejná URL Google Business Profile.
2. Reálne recenzie so súhlasom autora a dátumom.
3. Potvrdené popisy realizácií: typ objektu, materiál, okres, výmera a fáza práce.
4. Verejné prípadové štúdie a kvalitné zmienky tretích strán.
5. Verejné odkazy na relevantné registre, ak sú presné a aktuálne.

## QA pred nasadením

1. Prejsť produkčné HTTP odpovede pre Googlebot, OAI-SearchBot, Claude-SearchBot a Claude-User.
2. Overiť robots, sitemap, canonical, jeden H1, title, description a JSON-LD.
3. Skontrolovať, že formulár, tracking, consent a platené landing URL sa nezmenili.
4. Overiť, že žiadny údaj nepredstiera nezávislé overenie bez zdroja.
5. Nasadiť až z čistého Git SHA, nikdy z dirty worktree.
