# AUDIT.md

Audit dátum: 2026-05-26  
Rozsah: `app/`, `src/`, `public/`, admin route, API route, DB/server moduly, konfiguračné súbory a SEO stránky.

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
- Nie všetky verejné stránky majú vlastný `BreadcrumbList` JSON-LD.
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
3. BreadcrumbList JSON-LD doplniť na všetky verejné stránky.
4. Lighthouse mobile audit pre hlavnú stránku, cenu, postup a FAQ.
5. Refaktor CSS do dizajn-token vrstvy, bez zmeny vizuálu.
6. Admin QA test s reálnym browserom po prihlásení.
