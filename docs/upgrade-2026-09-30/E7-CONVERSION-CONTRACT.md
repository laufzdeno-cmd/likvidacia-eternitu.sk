# E7 – potvrdený dopyt ako konverzná udalosť

## Rozhodnutie pred zmenou kódu (1. 10. 2026)

- Služba: bezpečná likvidácia azbestu a eternitu. Návštevník chce rýchlo a nezáväzne zistiť postup a cenu; hlavnou akciou je odoslať krátky dopyt. Meranie má majiteľovi ukázať, ktoré kampane prinášajú skutočne prijaté dopyty, nie kliknutia na tlačidlo.
- Tento rez **nemení** formulár, prílohy, príjemcov, e-mail, reklamné účty ani produkciu. Opravuje iba kontrakt: až serverom potvrdené uloženie dopytu smie v JSON odpovedi vytvoriť pseudonymný konverzný identifikátor. Rovnaké opakovanie musí dostať rovnaký identifikátor; konfliktné a chybové odpovede nikdy nie.
- Identifikátor vychádza zo stabilného UUID pokusu, ktoré prehliadač už posiela. Neobsahuje meno, e-mail, telefón, adresu, poznámku, súbor ani databázové ID. Typ materiálu sa zredukuje na štyri všeobecné kategórie. E-mailový stav nemení fakt prijatia dopytu.
- Prehliadač udalosť spracuje iba pri marketingovom súhlase. Samotná JSON odpoveď ani lokálna udalosť **nie sú dôkaz**, že Google Ads alebo Meta konverziu prijali. Načítanie externých značiek, CSP, ich presné ID/štítky, odvolanie súhlasu, deduplikácia v cieľových účtoch a možné existujúce GTM/edge značky vyžadujú samostatný test pred zapnutím. Žiadna externá značka sa týmto rezom nepridáva.
- Výkon: iba malé JSON pole v už existujúcej odpovedi, bez ďalšej sieťovej požiadavky. Kontrakt sa dá zmeniť bez zásahu do transakcie dopytu. Interná analytika a reklamné konverzie zostávajú oddelené.

## Akceptácia tohto rezu

1. Nový aj idempotentne opakovaný dopyt vracajú rovnaký bezpečný `metaLead.eventId`; chybový/nepotvrdený výsledok ho nevracia.
2. Materiál sa mapuje na `vlnity`, `plocha`, `iny`, `neviem` bez voľného textu.
3. Žiadny živý dopyt, e-mail, pixel ani produkčný deploy nie je súčasťou testu.
