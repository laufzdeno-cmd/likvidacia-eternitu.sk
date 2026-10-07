# Verejné profily a recenzie — read-only kontrola 7. 10. 2026

## Rozsah

Kontrola bola iba na čítanie. Nebol upravený Google Business Profile, Google Ads, firemný účet, web, recenzia ani verejný katalóg. Nebola zverejnená ani skopírovaná žiadna recenzia zákazníka.

## Overené pozorovania

- V prihlásenom účte bol 7. 10. 2026 dostupný spravovaný Google Business Profile firmy ASTANA, s.r.o. Verejná karta v čase kontroly zobrazovala hodnotenie **5,0 z 5 pri troch viditeľných recenziách**. Nebol overený pôvod jednotlivých recenzií, vzťah autorov k firme ani súhlas na prevzatie ich obsahu. Hodnotenie sa preto nepreberá na web ani do `Review` alebo `AggregateRating` schémy.
- Profil zobrazoval kategóriu **„Azbestové testy“**, zatiaľ čo kontrolovaný web komunikuje predovšetkým odstraňovanie a likvidáciu azbestu. Eviduje sa to ako obsahový nesúlad na manuálne preverenie, nie ako potvrdenie, že Google kategóriu vyhodnotil nesprávne. Profil nebol upravený.
- V kontrolovanom profile bola ako webová adresa zobrazená staršia URL `astana.sk/Likvidacia-azbestu`, nie nový kanonický web `likvidacia-eternitu.sk`. V tomto kroku sa adresa nemenila a nebolo osobitne overené jej aktuálne technické presmerovanie.
- V zobrazených podkladoch Google Ads boli viditeľné formulácie „certifikovaný tím“ a tvrdenie o bezplatnej doprave. Kontrola nepotvrdila, či boli tieto konkrétne texty v čase kontroly aktívne doručované, ani či predstavovali všetky aktuálne reklamné varianty. Texty sú v konflikte s kandidátom webu, ktorý nedoložené označenie nepoužíva a dopravu uvádza ako individuálnu položku cenovej ponuky. Reklamný účet ani kampane sa nemenili.
- Vo výsledkoch vyhľadávania bola viditeľná staršia zmienka s možným reputačným dopadom. V tomto kroku nebol získaný primárny dokument ani dôveryhodný údaj o výsledku alebo uzavretí danej veci. Nemožno preto vyvodiť porušenie, začatie ani výsledok konania. Záznam sa eviduje iba ako neoverený historický reputačný signál na manuálne preverenie a nesmie sa publikovať ako firemné tvrdenie ani použiť ako dôkaz kvality či nekvality.

## Rozhodnutie pre web

- Verejná stránka recenzií ostáva fail-closed: bez súhlasu a dohľadateľného pôvodu nepreberie text, meno, fotografiu ani hviezdičky z cudzej platformy.
- Do `Review` ani `AggregateRating` schémy sa nepridáva rating z Google, Azetu alebo Zlatých stránok.
- Pozorovanie spravovaného profilu a verejného súhrnu 5,0 z 5 pri troch viditeľných recenziách umožňuje zmeniť G08 z `WAITING` na **PARTIAL**, nie na `PASS`. G08 zostáva otvorené do manuálneho preverenia kategórie a webovej adresy a do preukázania pôvodu a súhlasov ku konkrétnym recenziám.
- Úprava Google profilu a reklamných tvrdení patrí do osobitného účtového release s vlastným schválením a snímkou stavu pred a po zmene.

## Verejné zdroje použité na krížovú kontrolu identity

- [Kontakt ASTANA](https://www.astana.sk/kontakt)
- [Zoznam oprávnených subjektov ÚVZ SR — archívny dokument 2024](https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf)
- [Profil ASTANA v katalógu Azet](https://www.azet.sk/firma/958460/astana-s-r-o/)
- [Výsledky Zlaté stránky pre likvidáciu azbestu v Poprade](https://www.zlatestranky.sk/firmy/Poprad/q_likvid%C3%A1cia%2Bazbestu/1/)

Google Business Profile a Google Ads boli kontrolované v prihlásenom účte a ich presné interné URL ani hodnoty tajomstiev sa nezapisujú do repozitára.
