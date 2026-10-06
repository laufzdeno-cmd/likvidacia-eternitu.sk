# E3 – lokálna kontrola renderovaných verejných stránok

## Rozhodnutie pred implementáciou

Web predáva jednu službu cez nezáväzný dopyt. Pri každej verejnej URL musí návštevník aj vyhľadávač vidieť jasný hlavný nadpis, výstižný titulok a funkčnú cestu k ďalšiemu kroku. Táto kontrola priamo podporuje S01/S03 a F14 v [akceptácii](ACCEPTANCE.md); nemení obsah ani formulár.

Vstupom je optimalizovaný lokálny build, nie produkčná stránka. Kontrola číta skutočné prerenderované HTML a sitemapu. Bez spúšťania JavaScriptu stránky overí jeden H1, neprázdny titulok/popis, ich jedinečnosť medzi statickými indexovateľnými URL, interné odkazy a existenciu kotiev na statických cieľoch. Odkazy na dynamické URL zo sitemapy sa označia ako cieľ vyžadujúci samostatný HTTP test. Technické ciele `/sitemap.xml`, `/robots.txt` a historické presmerovanie `/cena/` sú výslovné výnimky; žiadne iné neznáme cesty sa automaticky nepovolia.

Výkon návštevníka sa nemení: ide len o lokálny QA príkaz. Kontrola neotvára živý web, neodosiela dopyty ani externé požiadavky. Nenahrádza crawl produkcie, test JS tlačidiel, skutočný mobil, presnosť firemných tvrdení ani kontrolu dynamických stránok. Zistené chyby sa opravujú v konkrétnych konzumentoch bez vytvárania klonovaných stránok.
