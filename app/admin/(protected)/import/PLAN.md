# Oprava historického CSV importu

Import používa iba superadmin na spätné zadanie zákaziek. Úspech znamená, že pred potvrdením vidí všetky chyby v súbore a po potvrdení vzniknú buď všetky nové záznamy, alebo žiadny. Pri zopakovaní rovnakých dát nesmú vzniknúť ďalšie zákazky.

- Formát: 16 pomenovaných stĺpcov vrátane povinného stabilného `id_zakazky`; čiarka alebo bodkočiarka sa určí pre celý súbor. Úvodzovky umožnia oddeľovač aj nový riadok v hodnote. Zoznam pracovníkov oddelený bodkočiarkou patrí do jediného CSV poľa. Starý formát bez ID sa odmietne.
- Kontrola: rovnaký parser v náhľade a na serveri. Server po autorizácii a CSRF znovu skontroluje každý riadok, počet stĺpcov, dátum, čísla, povolené voľby, pracovníkov a duplicity v súbore. Chybný súbor sa nezapíše.
- Uloženie: jedna PostgreSQL transakcia pre zákazky, pracovníkov, náklady a audit. Interný identifikátor je odvodený zo zdrojového ID zákazky, nie z jej obsahu; existujúci identifikátor sa uzná len so zhodným auditným odtlačkom celého riadku. Dve zákazky s rovnakými údajmi a rôznymi ID zostanú oddelené. Opravený riadok s pôvodným ID sa zastaví na ručnú kontrolu namiesto vytvorenia duplicity. Súbežný retry chráni primárny kľúč.
- Staršie importy nemajú odtlačok. Ak existuje zhodná historická zákazka označená pôvodným importom, nový import sa zastaví na ručné preverenie; automatické spojenie bez stabilného identifikátora by mohlo zameniť dve skutočné zákazky.
- Hranice: bez zmeny schémy a bez zásahu do PDF, ponúk, dopytov či verejného webu. Lokálna JSON databáza neposkytuje spoločnú transakciu pre celý súbor; import pri nej bezpečne odmietne zápis. Produkčný import ani nasadenie nie sú súčasťou tejto opravy.
- Overenie: parser vrátane úvodzoviek/diakritiky a chyba v neskorom poli; databázový test rollbacku, opakovaného a súbežného importu na jednorazovej testovacej databáze; typová kontrola a build, ak to prostredie dovolí.
