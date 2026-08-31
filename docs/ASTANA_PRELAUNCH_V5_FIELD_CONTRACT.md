# ASTANA — pre-launch cleanup V5: kontrakt formulára

Stav pred zmenou bol overený na produkčnej HTML odpovedi 31. 8. 2026. Táto tabuľka je hranicou V5: okrem výslovne schválenej voľby pre neznámu výmeru sa nemení povinnosť žiadneho poľa a žiadna otázka sa neodstraňuje.

| Pole | Aktuálny stav | V5 stav | Dôvod |
| --- | --- | --- | --- |
| Približná výmera | povinné kladné číslo | povinné, alebo výslovná voľba `lead_area_unknown` | Nevyžadovať vymyslené m²; interný stav sa zobrazuje ako „Neviem približnú výmeru“. |
| Obec / mesto | povinné | bez zmeny | Lokalita je nutná pre posúdenie realizácie. |
| Okres | voliteľné | bez zmeny | Pomocný údaj. |
| Typ azbestu | povinné | bez zmeny | Menia sa iba verejné labely. |
| Typ objektu | povinné | bez zmeny | Nutné pre posúdenie rozsahu. |
| Strechár | voliteľné | bez zmeny | Doplnkový pracovný kontext. |
| Termín | voliteľné | bez zmeny | Doplnkový pracovný kontext. |
| Preferovaný kontakt | predvolené volanie | bez zmeny | Voliteľná preferencia, nie ďalšia povinnosť. |
| Telefón | povinné | bez zmeny | Potrebný kontakt. |
| Meno a priezvisko | povinné | bez zmeny | Identifikácia dopytu. |
| E-mail | povinné | bez zmeny | Potvrdenie a ďalší postup. |
| Fotky | voliteľné | bez zmeny | Pomáhajú, ale neblokujú dopyt. |
| Poznámka | voliteľné | bez zmeny | Doplnkový kontext. |
| Súhlas so spracovaním dopytu | povinný | bez zmeny | Zákonný základ na vybavenie dopytu. |
| Marketingový súhlas | samostatný cookie consent | bez zmeny | Bez súhlasu nevzniká Pixel/CAPI marketingová udalosť. |

## Uloženie neznámej výmery

`area_estimate` ostáva číslo kvôli existujúcemu CRM a cenovým ponukám. Pri výslovnej voľbe sa uloží technický sentinel `0` spolu s `raw_data.areaEstimateStatus = "lead_area_unknown"`. Verejné e-maily a CRM obrazovky sentinel nikdy nevypisujú ako `0 m2`; zobrazia stav „Neviem približnú výmeru“. Cenovú ponuku nemožno vytvoriť bez doplnenia skutočnej výmery.
