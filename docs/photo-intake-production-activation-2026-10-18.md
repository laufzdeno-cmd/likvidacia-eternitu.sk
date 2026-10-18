# Produkčný príjem fotografií realizácií – 18. 10. 2026

## Zámer

Superadmin alebo pracovník pridá fotografie k dokončenej CRM zákazke. Fotografia
zostáva súkromná, kým ju superadmin interne neschváli. Firemný asistent potom
pripraví súkromný koncept realizácie a pripojí k nemu schválené fotografie.
Verejné publikovanie ostáva samostatným ľudským rozhodnutím po potvrdení práv,
bezpečnej lokality a pravdivosti obsahu.

## Produkčná konfigurácia

- vytvorené oddelené Vercel Blob úložisko `astana-photo-intake-prod`, región
  `fra1`, režim `private`;
- úložisko je pripojené iba k produkčnému prostrediu cez samostatnú premennú
  `PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN`;
- vytvorený nový 48-bajtový podpisový kľúč relácie;
- nastavená presná väzba projektu, produkčnej databázy a tokenu úložiska;
- príjem aj retenčný worker sú explicitne povolené iba v produkcii;
- všeobecný Blob zákazníckych dopytov sa nepoužíva a jeho premenné sa nemenili.

## Retencia

- nedokončené nahratie: 1 deň;
- fotografia čakajúca na kontrolu: 30 dní;
- zamietnutá fotografia: 7 dní;
- interne schválená fotografia bez pripojenia ku konceptu: 180 dní;
- fotografia pripojená k súkromnému alebo publikovanému prípadu sa automaticky
  neodstráni, kým superadmin prípad alebo fotografiu vedome neodoberie.

Retenčný proces najprv atómovo prevezme DB záznam, až potom maže súkromný objekt.
Pri chybe zostane záznam vo fronte na opakovanie; systém nesmie hlásiť odstránenie
bez potvrdenia úložiska.

## Overenie pred vydaním

- Private Blob smoke: anonymné čítanie `403`, autorizované čítanie `PASS`,
  technický objekt po skúške odstránený;
- cielené foto/kariéra/autopilot testy: `30/30 PASS`;
- formulár a lead bezpečnostné kontrakty: `68/68 PASS`;
- TypeScript: `PASS`;
- Next.js 16.4 produkčný build: `PASS`, 110 trás;
- izolované DB testy asistenta: `2/2 PASS`;
- dlhý browser harness prešiel podstatnú časť súkromného toku, ale jeho posledný
  beh nemá čistý PASS pre nestabilné časovanie lokálneho Next dev servera a
  zámerne spomaleného obrazového emulátora. Tento bod sa nenahrádza tvrdením o
  úplnom end-to-end dôkaze; po nasadení treba ešte overiť stav portálu a cron na
  konkrétnom produkčnom deployment-e bez vytvorenia falošnej zákazky.

## Prevádzkový tok

1. Superadmin vyberie dokončenú zákazku v `Fotky z terénu`.
2. Fotky nahrá priamo cez `Nahrať fotky teraz` alebo odovzdá jednorazový kód
   pracovníkovi.
3. Server overí formát, dekóduje obrázok, odstráni metadáta a uloží JPEG derivát
   do súkromného úložiska.
4. Superadmin doplní iba približnú lokalitu a kategóriu a fotografiu interne
   schváli.
5. Asistent pri najbližšom úspešnom plánovanom behu vytvorí alebo doplní
   súkromný koncept realizácie. Desaťminútový rozvrh nie je garancia času
   spracovania; pri dočasnej chybe sa položka bezpečne ponechá na ďalší beh.
6. Superadmin skontroluje text, fotky, práva a anonymizáciu a až potom prípad
   schváli a zverejní. Publikovaný prípad možno okamžite stiahnuť.
