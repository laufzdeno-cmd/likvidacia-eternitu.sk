# Tím a rozdelenie práce – 27. 10. 2026

Etapa: nezávislé vizuálne a obsahové prijatie verejných stránok podľa `public-polish-plan-2026-10-27.md`.

| Úloha | Dostupný vykonávateľ | Vlastníctvo | Dôkaz prijatia |
| --- | --- | --- | --- |
| Integrácia a opravy | Hlavný Codex | app/src, testy, kandidát a koordinácia | Build, kontrola renderu a prevzatie kontrolórom |
| Nezávislý GPT vizuálny kontrolór | `gpt_public_visual_controller`, rola independent_reviewer | Len vlastný report a screenshoty | Per-URL matica, konkrétne vady, PASS/RETURN WITH DEFECTS |
| Nezávislá obsahová kontrola | `public_copy_controller`, rola independent_reviewer | Len vlastný report a dôkazy | Konkrétne úpravy prirodzenej slovenčiny a verdikt každej URL |
| Fotografický inventár | `public_photo_inventory`, rola explorer | Len vlastný inventár a dôkazy | Mapa výskytov, variantov, voľných originálov a miest implementácie |
| Fotografická dátová evidencia | `public_photo_registry_worker`, rola worker | Centrálne rozdelenie fotografií, metadáta, úzke testy | 79 jedinečných identít a kontrola reálneho renderu koordinátorom/kontrolórom |
| Potvrdená 12-mesačná lehota analytiky | `analytics_retention_worker`, rola worker | Iba retencia, jej cron, budúce analytické backupy a testy | Izolované lokálne, PGlite a PostgreSQL 17 dôkazy; samostatný kontrolór |
| Nezávislé prijatie retencie | existujúci `gpt_kontrolor_ponuky`, rola independent_reviewer, nová ohraničená úloha | Iba kontrolný report a vlastné testové dôkazy | Vlastné opakovanie lokálnych, PG a TypeScript kontrol; produkcia oddelená |

Použili sa dostupní vstavaní GPT subagenti s nastavením zdedeným od hlavného Codexu. Nepripojil sa nový platený poskytovateľ ani externé API. Presná peňažná cena tejto práce nie je z dostupných dôkazov známa. Výber rolí zodpovedá oddeleným otázkam; žiadny model sa vopred neoznačuje za najlepší. Kvalita výstupov je do nezávislého prevzatia NEOVERENÁ.

Kontrolóri nemenia aplikačný kód, aby zostali nezávislí. Explorer zodpovedá konkrétnu otázku o fotografiách; jeho mapovanie sa zbytočne neopakuje. Hlavný Codex skontroluje dôkazy, rozhodne o opravách a odovzdá presný zostavený kandidát na opätovné prevzatie. Ďalší model alebo ďalšia rola sa pridá iba pri konkrétnom prínose.

Retenčný rozsah vznikol až po konkrétnej odpovedi majiteľa „12 mesiacov“. Rozšírenie tímu bolo postupné, najviac tri súbežné podúlohy popri koordinátorovi. Existujúci kontrolór bol opätovne použitý; nejde o tvrdenie, že je automaticky najlepší na databázy. Jeho prijatie je podložené konkrétnymi opakovanými skúškami. Záverečné verdikty tejto etapy sú naviazané na kandidáta a hranice v `public-polish-acceptance-2026-10-27.md`.
