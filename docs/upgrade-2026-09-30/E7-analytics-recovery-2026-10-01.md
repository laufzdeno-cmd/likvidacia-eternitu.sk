# E7 – serverové meranie a obnova konverzií

Stav k 1. 10. 2026. Tento dodatok je aktuálnejší než chronologické staršie poznámky v `STATUS.md`.

- `form_submit_success` sa zapisuje serverovo zo skutočne uloženého leadu, len pri analytickom súhlase, s ID leadu ako deduplikačným kľúčom a bez kontaktnej PII.
- `analyticsSessionId` neovplyvňuje identitu opakovania formulára. Natívny submit môže dostať serverovú session, zariadenie sa klasifikuje z user-agentu a udalosť používa pôvodný čas prijatia leadu.
- Lokálny JSON zápis serializuje zápisy a pri staršom snapshote zlúči analytické udalosti. Konverzie majú samostatnú retenciu od najviac 5 000 bežných udalostí.
- Chýbajúce súhlasom povolené udalosti sa obnovujú cez denný chránený cron. Dávka zachová čiastočné výsledky, pokračuje po chybe jednotlivého záznamu a neplatné sessions hlási osobitne, aby neblokovali platné leady. Obnova nemení pôvodný čas leadu ani neposiela e-mail.
- Nezávislý GPT re-review opráv recovery: `PASS`. Následný malý refaktoring dávkového zápisu má uložený regresný test; jeho nezávislý re-review ešte čaká.

Overené po poslednom refaktoringu: `test:unit` 120/120, `test:lead-form` 47/47, izolovaný PGlite `test:db-integration` 1/1, `typecheck` PASS, lokálny `next build` 90/90 trás PASS. `git diff --check` bez chýb, iba upozornenia LF/CRLF.

Obmedzenia: tento interný event sám osebe neposiela konverziu do Google Ads ani Meta. V tomto scope nie je potvrdený produkčný reklamný tag, živý PostgreSQL, viacprocesový súbeh lokálneho JSON, celý cron v runtime, browser flow ani doručenie e-mailu. Zmena nebola nasadená a nebol odoslaný skutočný dopyt.
