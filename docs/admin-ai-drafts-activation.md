# Aktivácia AI návrhov v administrácii

Aktuálny stav je zámerne **fail-closed**. Obrazovka `/admin/ai-asistent` vždy
ponúka transparentné lokálne šablóny. Serverový adapter pre Vercel AI Gateway
je pripravený, ale externé volanie je možné iba po súčasnom splnení dvoch
podmienok: `ASTANA_AI_DRAFTS_ENABLED=true` a platné serverové overenie Gateway.
Bez nich sa adapter ukončí ešte pred sieťovým volaním.

Pred produkčnou aktiváciou treba:

1. bezpečnostne schváliť model `openai/gpt-5.4` cez Vercel AI Gateway,
2. overiť, že serverové poverenie nie je dostupné klientovi,
3. preveriť limity, timeout, audit bez obsahu promptu a ochranu proti prompt injection,
4. potvrdiť rozsah redakcie osobných údajov; meno zostáva lokálne a do modelu sa neposiela,
5. otestovať zlyhanie providera, náklady a slovenskú kvalitu výstupu,
6. nastaviť serverové overenie Gateway,
7. až potom nastaviť `ASTANA_AI_DRAFTS_ENABLED=true`.

Samotný env flag nestačí. Externý návrh vznikne až po explicitnom kliknutí
prihláseného admina; vstup prejde serverovou validáciou, limitom a redakciou
rozpoznaných formátov e-mailu, telefónu, odkazu, PSČ a niektorých presných
adries. Regexová redakcia nemôže zaručiť zachytenie všetkých osobných údajov,
preto sa do poľa faktov nesmú vkladať mená, celé adresy, identifikátory vozidiel,
rodné čísla, zdravotné, platobné ani iné nepotrebné osobné údaje. Návrh sa nikdy
automaticky neodošle zákazníkovi, neuloží do CRM ani nepremení na schválenú
cenovú ponuku. Pred produkčným zapnutím je stále potrebná samostatná bezpečnostná,
nákladová a kvalitatívna akceptácia.
