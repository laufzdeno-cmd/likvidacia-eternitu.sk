# Autonómny firemný asistent — implementačný plán

Dátum: 15. 10. 2026  
Projekt: likvidacia-eternitu.sk  
Rozsah: interná administrácia, bez zmeny verejného dopytového formulára, reklám, analytiky a verejných SEO textov.

## 1. Obor, používateľ a jediný cieľ

- Služba: bezpečná demontáž, odvoz a likvidácia azbestu a eternitu.
- Interný používateľ: operátor alebo superadmin, ktorý potrebuje spracovať dopyt bez prepisovania údajov medzi obrazovkami.
- Bolesť: ručné vytváranie CP, ručné sledovanie odpovedí, zabudnuté follow-upy a opakované prepisovanie údajov do realizácie a referencie.
- Jediná požadovaná akcia administrátora: skontrolovať pripravený návrh, prípadne ho jemne upraviť a výslovne schváliť krok smerom k zákazníkovi alebo na verejný web.

## 2. Rozhodnutie o architektúre

Projekt už má odolné databázové workflow, audit, SMTP claimy, súkromné fotografie a schvaľovanie. Preto sa nepridáva nový agent framework ani LLM závislosť. Asistent bude deterministický a idempotentný:

1. z databázových udalostí pripraví návrhy,
2. návrhy uloží ako bežné CRM záznamy,
3. zobrazí ich v spoločnej schvaľovacej fronte,
4. nikdy sám neodošle prvú CP, prvú žiadosť o referenciu ani nič nezverejní,
5. opakovaný beh nevytvorí duplikáty.

Tým zostáva správanie merateľné, auditovateľné a nezávislé od výpadku AI služby.

## 3. Stavový tok

```text
Dopyt prijatý
  -> zákazka vytvorená
  -> asistent vytvorí súkromný koncept CP (ak sú podklady dostatočné)
  -> človek upraví sprievodný list a schváli odoslanie
  -> odoslaná CP
       -> prijatá
       -> odložená + dôvod + dátum návratu
       -> neúspešná + dôvod
       -> bez reakcie -> pripravený follow-up
  -> realizácia dokončená
  -> schválené súkromné fotky sa pripájajú do konceptu realizácie
  -> človek overí práva, obsah a zverejní
  -> asistent pripraví žiadosť o referenciu
  -> človek schváli prvé odoslanie
  -> najviac jedna vopred povolená pripomienka
  -> zákazník odošle referenciu
  -> superadmin obsah skontroluje a zverejní
```

## 4. Schvaľovacie hranice

- CP sa nikdy neodošle bez aktuálneho kliknutia admina.
- Sprievodný list je uložený pri konkrétnej CP, verzovaný spolu s ponukou a pred odoslaním upraviteľný.
- Neistý výsledok SMTP vždy blokuje opakovanie do manuálneho overenia.
- Fotky zostávajú súkromné do interného schválenia a verejného publikačného súhlasu.
- Referencia sa po prijatí uloží len ako koncept; verejne ju môže zverejniť superadmin.
- Asistent nevymýšľa chýbajúcu výmeru, cenu, kontakt, súhlas ani adresu. Pri chýbajúcich údajoch vytvorí blokovanú položku práce.

## 5. Implementačné kroky

### P0 — obchodný tok

- Rozšíriť CP o upraviteľný predmet a sprievodný list.
- Pridať výsledky `odložená` a `neúspešná`, povinný dôvod a dátum ďalšieho kontaktu.
- Vytvoriť idempotentné zosúladenie asistenta, ktoré z vhodnej zákazky pripraví koncept CP.
- Pridať CP a splatné rozhodnutia do centrálnej schvaľovacej fronty.

### P1 — dokončená zákazka

- Automaticky pripraviť čakajúcu žiadosť o referenciu pre dokončenú reálnu zákazku.
- Schválené súkromné fotografie automaticky pripojiť k súkromnému konceptu realizácie.
- K súkromnému konceptu predvyplniť iba overenú približnú lokalitu a typ objektu z fotografie. Text, presnosť lokality a publikovanie ostávajú na človeku.

### P2 — prevádzka

- Pridať chránený cron a manuálne tlačidlo „Spustiť asistenta teraz“.
- Zobraziť výsledok behu: vytvorené CP, pripravené referencie, pripojené fotografie a blokované záznamy.
- Zalogovať systémového aktéra bez osobných údajov v auditných zmenách.

## 6. SEO, výkon a budúce rozšírenia

- Ide o autentifikovanú internú administráciu; nevzniká verejná URL, sitemap položka, schema ani nový indexovateľný obsah.
- Verejný dotazník, tracking a reklamné landing pages sa nemenia.
- Beh je dávkový, limitovaný a idempotentný, aby nepredlžoval verejné requesty.
- Stavový model je rozšíriteľný o neskoršie doručenie, e-podpis alebo automatické prijatie objednávky bez prerábania CP dokumentu.

## 7. Akceptácia

- Nový úplný dopyt po behu asistenta získa najviac jeden koncept CP.
- CP obsahuje profesionálny upraviteľný sprievodný list a odošle sa až po schválení.
- Odloženie a neúspech bez dôvodu nie sú možné.
- Dokončená reálna zákazka s emailom získa najviac jednu čakajúcu žiadosť o referenciu.
- Jedna schválená fotografia sa pripojí najviac raz ku konceptu tej istej zákazky.
- Žiadny automatický beh neposiela prvý externý email ani nepublikuje obsah.
- Relevantné integračné testy, TypeScript a produkčný build musia prejsť.
