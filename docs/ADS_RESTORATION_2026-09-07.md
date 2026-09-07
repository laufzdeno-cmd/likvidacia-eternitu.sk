# Obnova Google Ads merania

Zaklad: 23c81aec37ddf6197119e986d9fa3c2e2cf7878b, live dpl_66HM7DPk6T3LsmjHRJmU55QNoyfC.

Ciel: merat iba serverom potvrdeny dopyt na homepage, bez zmeny API, databazy, mailu, Meta alebo formularoveho transportu. Jediny aktualny lead formular je v app/page.tsx; starsia lead vetva v landing-client.tsx sa neprepisuje ani neaktivuje.

Basic consent model: Google script sa nacita az pri existujucom marketingovom suhlase. Odmietnute konverzie sa neskor neprehravaju. Pri odvolani sa vymaze neodoslany front. ID odoslania sluzi ako transaction_id, s pamatovou a session deduplikaciou. Ziadne meno, email ani telefon v evente; enhanced conversions ani GA4 sa nezapinaju.

Zmeny: samostatny klientsky tag, Ads helper, import a jediny riadok po uspesnej odpovedi homepage formulara, root mount, konkretne Google CSP origins, informacia v cookies, automaticky build guard a testy. Ziadna zmena marketing consent storage/Meta odvolania. Existujuci consent UX sa nemeni.

QA: skutocne funkcie submitLeadForm/onSubmit sa transpiluju a vykonaju v izolovanom VM s mock fetch. Toto nie je browser E2E. 5.5s test bezi v realnom case, timeout test overi 30000ms a simuluje abort zrychlene. Testy nikdy neposielaju data Googlu, email ani lead. Externy tag a CSP sa overia osobitne v staged browseri bez submitu.

Release: testy, typecheck, cisty commit, production-target staged build, GET/browser smoke, kontrola aktualneho live pointera, promote existujuceho kandidata, live smoke. Pri regresii rollback deploymentu bez DB rollbacku. Ziadny produkcny POST.

Oficialne podklady:
- https://developers.google.com/tag-platform/security/concepts/consent-mode
- https://developers.google.com/tag-platform/security/guides/csp
