# AUDIT.md

Audit dátum: 2026-05-26  
Rozsah: `app/`, `src/`, `public/`, admin route, API route, DB/server moduly, konfiguračné súbory a SEO stránky.

## Aktualizácia 2026-05-26

- Doplnený spoločný `BreadcrumbList` JSON-LD komponent a napojený na verejné stránky, ktoré ho nemali.
- Mobilný Lighthouse audit bol spustený pre `/`, `/cena-likvidacie-azbestu/`, `/postup/` a `/faq/`. JSON reporty sú uložené v `test-results/`.
- Opravený kontrast CTA, aktívnych filtrov, cookie tlačidla a drobných textov, ktoré Lighthouse označil cez `color-contrast`.
- Po LCP optimalizácii hero obrázka, vypnutí agresívneho font preloadu a pridaní `content-visibility` pre podprehybové sekcie: úvod `95/100/100/100`, cena `95/100/100/100`, postup `95/100/100/100`, FAQ `97/100/100/100` v poradí Performance / Accessibility / Best Practices / SEO.
- Zvyšné riziko: mobilné LCP je výrazne lepšie, ale pri opakovaných Lighthouse behoch stále kolíše. Posledný kompletný beh: úvod približne `2.9 s`, cena `2.9 s`, postup `2.9 s`, FAQ `2.3 s`. Najlepší samostatný beh úvodu po vypnutí font preloadu bol približne `2.6 s`. Ďalší výkonový krok má byť rozdelenie historických globálnych CSS/JS vrstiev a odloženie nepotrebnej klient-side logiky mimo prvý render.
- Rozdelený verejný klientsky JavaScript: jednoduché obsahové stránky používajú ľahký `PublicBaseClient`, cenová stránka a interaktívne stránky ostávajú na plnom `LandingClient`. Verejné widgety boli presunuté z root layoutu do verejných stránok, takže admin login už nenačítava cookie/WhatsApp prvky.
- Po rozdelení klienta prebehol ďalší mobilný Lighthouse: úvod `88/100/100/100` pri LCP `3.2 s` v opakovanom behu, cena `97/100/100/100` pri LCP `2.1 s`, postup `92/100/100/100` pri LCP `3.0 s`, FAQ `93/100/100/100` pri LCP `3.0 s`. Jednoduché stránky klesli približne na `295 KiB`, úvod ostáva okolo `349 KiB`, lebo stále potrebuje plnú landing interaktivitu.
- Praktická kontrola v prehliadači potvrdila, že FAQ stránka renderuje verejné widgety a admin login ich už nemá.
- Homepage klient bol rozdelený samostatne: kritický `HomepageCriticalClient` drží navbar, sticky header, `#dopyt` formulár, uploady, hash scroll, analytiku a hero counter animácie; podfoldový `HomepageBelowFoldClient` sa importuje až pri priblížení k realizáciám a rieši filter realizácií a scroll reveal efekty. Text všetkých sekcií zostal v SSR HTML.
- Po tomto splite homepage Lighthouse mobile 3x: Performance `96`, `95`, `96`; Accessibility/Best Practices/SEO vždy `100/100/100`; LCP `2.57 s`, `2.79 s`, `2.49 s`, priemer približne `2.62 s`; CLS `0.000`; TBT približne `13 ms`. Cieľ Performance `95+` je splnený, LCP je výrazne lepšie než predchádzajúci `3.2 s`, ale priemer ešte tesne nesplnil cieľ pod `2.5 s`.
- Po deployi na produkciu vyšiel Lighthouse mobile 3x na `https://likvidacia-eternitu.sk/`: Performance `96`, `98`, `98`, priemer `97.3`; LCP `2.55 s`, `2.35 s`, `2.34 s`, priemer približne `2.42 s`; Accessibility/Best Practices/SEO vždy `100/100/100`. Produkčný cieľ LCP pod `2.5 s` a Performance `95+` je splnený.
- Skúšané boli aj priority hint úpravy preloadu a odloženie verejných widgetov na homepage. Keďže v meraní zhoršili LCP/Performance alebo nepriniesli zisk, boli vrátené.
- Poznámka k meraniu: Lighthouse CLI na Windows uložil reporty, ale po každom behu hlásil `EPERM` pri mazaní dočasného Chrome priečinka. Výstupné JSON reporty boli vytvorené a použité na vyhodnotenie.

## Čo už spĺňa štandardy (ponechať)

- Projekt používa Next.js App Router a server-renderované stránky pre verejný obsah.
- Admin a API majú `X-Robots-Tag: noindex, nofollow, noarchive`.
- `robots.txt` povoľuje verejný web a blokuje `/admin/` a `/api/`.
- Existuje dynamický `app/sitemap.ts`.
- Hlavný formulár má server-side validáciu cez Zod.
- Uploady majú kontrolu typu, prípony, veľkosti a magických bajtov súboru.
- Uploadované súbory sú riešené cez server/storage vrstvu a admin súborové route, nie ako verejné assety.
- Pri formulári sa dopyt ukladá aj keď zlyhá email; email chyba sa loguje.
- Login adminu má rate limit 5 pokusov na 15 minút.
- Admin má používateľské roly, nastavenia, zmenu hesla a reset hesla cez token.
- Cenová ponuka sa odosiela cez admin workflow, nie automaticky bez schválenia.
- Cenová stránka už neobsahuje verejnú tabuľku konkrétnych cien za m² ani `PriceSpecification`.
- Existuje business/admin workflow: dopyty, zákazky, ponuky, plánovač, recenzie, analytics, nastavenia.
- Firemné údaje v novších PDF/email šablónach smerujú na správne ASTANA údaje.

## Čo chýba (doplniť samostatne)

- Chýbal `PLANNING.md`; doplnené v tejto zmene.
- `BreadcrumbList` JSON-LD je doplnený na verejné stránky; pri nových URL treba použiť spoločný komponent.
- Chýbala vlastná 404 stránka; doplnené v tejto zmene.
- Chýbal verejný bezpečnostný kontakt `/.well-known/security.txt`; doplnené v tejto zmene.
- Chýba jednotný dizajn-token systém oddelený od historických CSS vrstiev.
- Chýba automatizovaný Lighthouse/axe CI gate.
- Chýba plná evidencia publikovateľnosti fotiek z terénu pred zobrazením vo verejnej galérii.
- Chýba finálne rozhodnutie, či zostáva iba first-party analytika alebo sa pridá externý analytický nástroj.
- Chýba explicitný disaster-recovery runbook: ako obnoviť databázu zo zálohy.

## Čo porušuje pravidlá (oprav a vysvetli prečo)

- Produkčný CSP povoľoval `unsafe-eval`. Opravené: `unsafe-eval` zostáva iba v neprodukčnom režime, aby sa znížilo riziko spustenia injektovaného skriptu v produkcii.
- Globálne structured data obsahovali iba LocalBusiness. Opravené: doplnené `Organization` a `WebSite`, aby AI vyhľadávače a Google lepšie rozpoznali entitu a web.
- Chýbal `PLANNING.md`, hoci ALFA pravidlá vyžadujú plánovaciu fázu pred zásahom. Opravené: pridaný plán s cieľmi, publikom, SEO témami a architektonickým smerom.
- Chýbala vlastná 404 stránka. Opravené: pridaná slovenská 404 s návratom na dopytový formulár.

## Bezpečnostné problémy (oprav okamžite)

- `unsafe-eval` v produkčnom CSP: opravené.
- Verejný bezpečnostný kontakt chýbal: opravené cez `public/.well-known/security.txt`.
- Potenciálne riziko hard-delete v adminovi: v zákazkách existuje archív aj zmazanie. Pri úplnom zmazaní treba zachovať striktné obmedzenie na `SUPER_ADMIN` a potvrdenie. Táto časť si vyžaduje samostatnú kontrolu workflow, aby sa nezmazali účtovné alebo právne relevantné údaje.
- Reset hesla závisí od `ADMIN_RESET_TOKEN`. Je to bezpečnejšie ako verejný reset bez tokenu, ale treba overiť, že token je silný a uložený iba vo Vercel env.
- CSRF ochrana v admin formulároch bola zavádzaná historicky, no treba urobiť samostatný test všetkých POST/PUT/DELETE route, či token skutočne vyžadujú všade.

## Čo treba so mnou prediskutovať pred zásahom (iba vypíš, neopravuj)

- Či sa `CLAUDE.md` má pridať do git repozitára, alebo zostane lokálny riadiaci dokument.
- Či má byť úplné zmazanie zákaziek ponechané, alebo nahradené výhradne archiváciou plus exportom.
- Či sa má použiť externá analytika/cookies, čo by menilo GDPR a cookie texty.
- Či majú byť Google recenzie napojené cez Google Business Profile API, alebo sa budú spravovať ručne v adminovi.
- Či všetky historické fotky z galérie majú byť označené stavom schválenia pred publikovaním.
- Či sa má admin úplne presunúť na `astana.sk` už teraz alebo až po stabilizácii CRM.
- Či zaviesť povinné 2FA pre všetkých admin používateľov, nielen voliteľne.

## Ďalšie odporúčané poradie prác

1. Bezpečnostný regresný test admin POST route a CSRF.
2. Audit upload visibility cez skutočné URL v produkcii.
3. Optimalizovať LCP na mobile pre úvod, cenu, postup a FAQ.
4. Refaktor CSS do dizajn-token vrstvy, bez zmeny vizuálu.
5. Automatizovaný Lighthouse/axe CI gate.
6. Admin QA test s reálnym browserom po prihlásení.
