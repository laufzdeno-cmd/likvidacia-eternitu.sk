# ASTANA – produkčný snapshot a obmedzenia overenia

Pozorovanie: 1. 10. 2026, 21:00 Europe/Bratislava. Read-only kontrola verejnej produkčnej stránky a dostupných pripojených účtov. Tento záznam nie je potvrdením release-u ani úplným auditom.

## Verejný web

- Homepage: https://likvidacia-eternitu.sk/
- Hlavné CTA a navigácia smerujú na existujúci formulárový kotviaci bod `#dopyt`; navigácia obsahuje aj /realizacie/ a /kariera/. Nebol vykonaný nový submit formulára.
- V zobrazenom stave live homepage formulár ukazoval úspešné prijatie a adresu pre potvrdenie. Samotný text v UI nie je dôkaz doručenia e-mailu do schránky.
- V produkčnej homepage sa stále zobrazujú tvrdenia „Doprava nad 100 m2 zdarma“ a „Pri väčších zákazkách dopravu neúčtujeme“, opakovane aj v ďalšej sekcii. Neskoršia kontrola historického schválenia majiteľom potvrdila presné podmienené znenie: „Pri ploche od 100 m² dopravu po Slovensku neúčtujeme.“ Produkčné varianty preto nie sú dôvodom odstrániť ponuku; treba ich zjednotiť na schválenú formuláciu a hranicu od 100 m².
- Produkčná pätička zobrazovala päť regionálnych odkazov (Poprad, Košice, Prešov, Žilina, Bratislava), nie všetkých osem. Predošlé lokálne úpravy teda na produkcii v tomto pozorovaní neboli.
- Formulár na https://www.astana.sk/Cenova-ponuka/cenova-ponuka-azbest zobrazuje samostatnú staršiu cenovú cestu. Nebola odoslaná ani menená.

## Formuláre a schránka

- Live dopytový formulár zobrazoval správu o úspešnom prijatí a že potvrdenie bolo poslané na kontaktnú adresu. Nový test sa v tomto pozorovaní neodoslal.
- Cielené hľadanie presne známych testovacích predmetov dopytu v Gmaili od 30. 9. neprinieslo zhodu. Nie je to úplný dôkaz nedoručenia, keďže predmet/čas testu nemusí zodpovedať filtru.
- V inboxe bolo nedávne oznámenie o reálnej kariérnej žiadosti. Z dôvodu ochrany osobných údajov sa tu neuvádzajú údaje uchádzača; tento email sa nepovažuje za testovací dôkaz.

## Vercel a pracovné prostredie

- Pripojený Vercel konektor pod jediným dostupným tímom vrátil projekt `autoservisy24-sk`; nevrátil ASTANA projekt. Čítanie deploymentu podľa domény `likvidacia-eternitu.sk` vrátilo 404. Tento výsledok znamená, že cez tento konektor nebolo možné overiť ASTANA deployment; nedokazuje, že projekt v účte neexistuje.
- Lokálny workspace opakovane odmietol spustiť proces chybou Windows `CreateProcessWithLogonW failed: 1909`. Nezávislí read-only agenti preto nedokázali otvoriť zdrojové súbory. Skúšaný nebol reset hesla ani zmena systému.
- Nebol upravený zdrojový kód, produkčný obsah, reklamné účty ani deployment. Nebol vytvorený nový lead ani odoslaný testovací e-mail.

## Ďalšie kroky po obnovení lokálneho prístupu

1. Skontrolovať aktuálny commit a dirty worktree; potom porovnať lokálny zdroj s aktuálnou produkčnou verziou.
2. Zjednotiť historické texty dopravy na presné schválené znenie; ceny a DPH overovať samostatne. Zachovať existujúce reklamné landing URL.
3. Zopakovať foto-intake, referencie, administráciu, atribúciu kampaní a bezpečné testy dopytových/kariérnych formulárov. UI úspech uznať iba po dohľadaní záznamu, príloh a správneho inbox dôkazu.
4. Nezávislý GPT kontrolór preskúmať konkrétne zmeny a následne pokračovať release bránami schváleného plánu. Bez osobitného release kroku nič nenasadzovať.
