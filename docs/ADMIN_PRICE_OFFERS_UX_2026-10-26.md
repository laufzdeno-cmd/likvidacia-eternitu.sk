# Prehľad ponúk a následný kontakt — plán úpravy

## Cieľ a používateľ

Operátorka má pri každej cenovej ponuke rýchlo vidieť stav a jednou zrozumiteľnou akciou otvoriť detail. Majiteľ má rozpoznať čakajúce, prijaté a problémové ponuky. Rozhranie je súčasťou prihláseného CRM; nemení verejný web, ponukovú logiku ani odosielanie emailov.

## Zistenia

- Neskoršie pravidlo štýlov vynucuje biele písmo pri všetkých stavoch, zatiaľ čo „Odoslaná“ má svetlý podklad.
- Akcie sú štyri samostatné odkazy v úzkom stĺpci, čo zväčšuje každý riadok tabuľky.
- Anglické „Follow-up“ sa používa v niekoľkých používateľsky viditeľných textoch adminu.
- Dátum platnosti vo formáte ISO sa v úzkom stĺpci neprirodzene láme.

## Rozhodnutia

1. Jedna zreteľná akcia „Otvoriť“ zostane na riadku. PDF, následný kontakt, výsledok a archivácia budú v prístupnom rozbaľovacom ovládaní „Ďalšie“. Rozbalenie zväčší iba zvolený riadok.
2. Farebné stavy budú mať kontrastné tmavé písmo a významové podklady: pripravená modrá, odosielanie fialová, neistota červená, odoslaná tyrkysová, odložená jantárová, prijatá zelená, neúspešná červená, zrušená sivá. Farba nebude jediným nositeľom informácie; text stavu zostáva.
3. Úprava CSS bude ohraničená triedami pre prehľad ponúk a stránku následného kontaktu. Na malých šírkach zostane čitateľná horizontálne posúvateľná tabuľka.
4. Viditeľný pojem „Follow-up“ nahradíme podľa kontextu „Následný kontakt“ alebo „Pripomenúť ponuku“. Interné názvy, URL a databázové stavy zostanú kompatibilné.
5. Formulár následného kontaktu zachová manuálne potvrdenie pred odoslaním. Žiadna skúšobná ponuka sa neodošle.

## Kontrola

Overiť typy a produkčný build, kontrast výsledných farieb, ovládanie klávesnicou a rozloženie od 320 px po desktop. Nezávislý GPT kontrolór preverí texty aj vizuálne riziká. Nasadenie iba z presne skontrolovaného kandidáta s možnosťou návratu.

SEO, kľúčové slová, sitemap, konkurencia, verejné CTA a rozšírenie e-shopu nie sú pri tejto prihlásenej obrazovke uplatniteľné; jej obsah sa neindexuje.
