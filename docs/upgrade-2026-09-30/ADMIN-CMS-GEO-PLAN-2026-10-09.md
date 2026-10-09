# Admin, realizácie a GEO – realizačný plán

## Cieľ

Rozšíriť existujúci admin tak, aby majiteľ firmy vedel bezpečne spravovať verejné texty, pripravovať dôveryhodné realizácie s fotografiami pred a po práci, kontrolovať publikované firemné fakty a spravovať prístupy bez ukladania hesiel do verejného obsahu alebo databázových textov.

Primárnou službou webu je odborná likvidácia azbestu a eternitových striech. Ideálny návštevník potrebuje rýchlo zistiť, či ASTANA rieši jeho typ stavby, lokalitu, dokumentáciu a nadväznosť strechárov. Hlavnou akciou zostáva krátky dopyt na cenovú ponuku; toto rozšírenie nesmie meniť jeho zmluvu ani odosielanie.

## Súčasný stav

- Admin už obsahuje dopyty, ponuky, zákazky, plánovač, realizácie, fotografie z terénu, referencie, analytiku, používateľov, audit, nastavenia a kontrolu systému.
- Texty úvodnej stránky sú editovateľné, ale formulár treba doplniť o CSRF token a serverový zoznam povolených polí s limitmi.
- Realizačné prípady už majú súkromný koncept a schvaľovací proces. Verejne sa smie ukázať iba približná lokalita; presná adresa zákazky zostáva interná.
- Fotografie majú schvaľovanie, ale k prípadu zatiaľ nemajú jednoznačnú fázu „pred / počas / po“ ani spravovateľné poradie a verejný popis.
- Admin heslo je možné meniť v aplikácii. Heslo schránky `astana@astana.sk` spravuje HostCreators a prevádzkové `SMTP_PASS` spravuje Vercel; aplikácia ich nesmie čítať späť, zobrazovať ani ukladať do databázy.

## Rozhodnutia

### 1. Texty webu

- Zachovať jeden spravovaný zdroj textov úvodnej stránky.
- Povoliť iba vopred definované polia a limity dĺžky.
- Zachovať zákonné a overené odpovede, ktoré sa nesmú prepísať nepravdivým tvrdením.
- Pridať jasné skupiny, náhľad webu a stav uloženia.

### 2. Realizácie a ochrana súkromia

- Presnú adresu čítať iba z internej zákazky a zobrazovať ju iba superadminovi.
- Do verejného prípadu ukladať len zvolenú obec alebo okres.
- Každej pripojenej a schválenej fotografii pridať fázu `pred`, `počas` alebo `po`, verejný popis a poradie.
- Verejný výstup zobraziť až po samostatnom schválení práv, lokality, obsahu a dôkazov.
- Nikdy nepublikovať GPS súradnice ani presnú adresu zákazníka.

### 3. GEO a tri weby ASTANA

Weby majú byť pomocné, nie duplicitné vstupné stránky:

- `www.astana.sk` – firemný profil ASTANA a širšie portfólio služieb.
- `likvidacia-eternitu.sk` – eternitové a azbestové strechy, cenová ponuka, demontáž a koordinácia so strechármi.
- `likvidovanie-azbestu.sk` – azbest na nehnuteľnosti, vnútorné a špecializované vonkajšie situácie.

Na tomto webe vznikne jedna ľuďom viditeľná stránka s overenými informáciami. Rovnaké údaje bude používať JSON-LD, strojovo čitateľný JSON a `llms.txt`. Nepridáva sa skrytý „text pre AI“; AI dostane iba pravdivé informácie, ktoré sú dostupné aj človeku.

### 4. Prístupy

- Zmenu hesla admina zachovať v aplikácii a po zmene zneplatniť staré relácie.
- Heslo e-mailovej schránky meniť iba cez oficiálnu správu HostCreators.
- Po zmene hesla schránky aktualizovať `SMTP_PASS` vo Verceli a overiť poštový systém cez existujúcu kontrolu systému.
- Admin nebude obsahovať pole, ktoré by tajné heslo ukladalo do databázy.

## Implementačné etapy

1. Opraviť a zabezpečiť editor verejných textov.
2. Doplniť internú adresu, fázy fotografií a poradie do konceptov realizácií.
3. Upraviť verejnú galériu a štruktúrované dáta realizácií.
4. Pridať stránku overených informácií, `company.json`, `llms.txt`, interné odkazy a sitemapu.
5. Doplniť bezpečné rozcestie pre admin heslo, HostCreators a Vercel SMTP nastavenie.
6. Spustiť kontraktné testy, typovú kontrolu, zostavenie a vizuálnu kontrolu verejnej časti aj adminu.

## Akceptačné podmienky

- Dopytový formulár ani jeho API sa v tejto etape nemenia.
- Verejná realizácia neobsahuje presnú adresu, GPS ani neschválenú fotografiu.
- Textový editor neprijme neznáme kľúče ani neobmedzený obsah.
- Heslá sa nezobrazujú, nelogujú a neukladajú ako bežný text.
- Verejný obsah, JSON-LD, JSON a `llms.txt` si významovo neprotirečia.
- Zmeny prejdú testami, buildom a vizuálnym náhľadom pred akýmkoľvek nasadením.

## Čo musí potvrdiť majiteľ

- ktoré dokončené zákazky a fotografie majú súhlas na verejné použitie,
- správnosť približnej lokality, typu objektu, materiálu, rozsahu a výsledku každej realizácie,
- aktuálnosť firemných údajov a verejných profilov,
- zmenu hesla schránky v HostCreators a následnú hodnotu `SMTP_PASS` vo Verceli,
- finálny lokálny náhľad pred nasadením.
