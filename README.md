# likvidacia-eternitu.sk

Full-stack základ pre ASTANA, s.r.o.:

- verejná slovenská landing page pre likvidáciu azbestu a eternitu,
- formulár na dopyt s uploadom fotiek,
- uloženie dopytu do databázy,
- bezpečné uloženie fotiek do storage,
- admin login na `/admin`,
- zoznam a detail dopytov,
- interné poznámky, statusy a audit log,
- vytvorenie základnej cenovej ponuky z dopytu.

## Lokálne spustenie

```bash
npm install
npm run dev
```

Lokálne bez `DATABASE_URL` aplikácia používa vývojový súbor `.data/local-db.json` a fotky ukladá do `storage/lead-files`.

## Build

```bash
npm run build
npm run preview
```

## Admin

Admin je na:

```text
/admin/login
```

Lokálne bez env premenných funguje vývojové prihlásenie:

```text
Email: admin@local.test
Heslo: astana-admin
```

V produkcii nastavte:

```bash
AUTH_SECRET=
ADMIN_EMAIL=astana@astana.sk
ADMIN_PASSWORD_HASH=
```

Hash hesla vytvoríte:

```bash
npm run admin:hash -- "silne-heslo"
```

## Produkčné env premenné

Použite `.env.example`.

Dôležité:

- `DATABASE_URL` musí smerovať na PostgreSQL databázu.
- `S3_*` premenné nastavte na S3 kompatibilné úložisko pre fotky.
- `SMTP_*` nastavte až pred ostrým odosielaním emailov.

Email je iba notifikácia. Hlavný systém je databáza a admin.

## Vercel

Projekt je Next.js aplikácia. Na Verceli nastavte framework preset `Next.js`, deploy preview môžete spraviť bez prepnutia domény.

Pred ostrým použitím nastavte:

```bash
NEXT_PUBLIC_SITE_URL=https://likvidacia-eternitu.sk
DATABASE_URL=
AUTH_SECRET=
ADMIN_EMAIL=astana@astana.sk
ADMIN_PASSWORD_HASH=
ALLOWED_ORIGINS=https://likvidacia-eternitu.sk,https://www.likvidacia-eternitu.sk,http://localhost:3000
LEAD_TO_EMAIL=astana@astana.sk
MAIL_FROM=astana@astana.sk
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=true
```

## Firemné údaje

Používajú sa aktuálne údaje:

ASTANA, s.r.o.  
Scherffelova 1364/28  
058 01 Poprad  
IČO: 46 157 701  
DIČ: 2023253771  
IČ DPH: SK2023253771  
0905 217 946  
astana@astana.sk
