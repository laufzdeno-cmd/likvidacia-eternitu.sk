# likvidacia-eternitu.sk

Statický lead-generating web pre doménu `likvidacia-eternitu.sk`, postavený na Vite + React tooling + TypeScript. Hlavný obsah homepage je priamo v `index.html`, aby ho vedeli čítať verejné crawlery aj bez spustenia JavaScriptu.

## Lokálne spustenie

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Produkčný výstup je v priečinku `dist`.

## GitHub Pages

Deploy rieši workflow `.github/workflows/deploy.yml`. V nastaveniach repozitára má byť GitHub Pages source nastavený na `GitHub Actions`. Custom doména je `likvidacia-eternitu.sk` a Vite `base` je `/`.

## SEO súbory

- `public/robots.txt`
- `public/sitemap.xml`
- `public/llms.txt`
- `public/data/company.json`
- právne stránky v `public/ochrana-osobnych-udajov/`, `public/cookies/`, `public/podmienky-pouzivania/`

## Dopytový formulár

Web je statický na GitHub Pages, preto formulár zatiaľ pripraví email cez `mailto:` na `astana@astana.sk`. Pre skutočné ukladanie dopytov a automatické emailové notifikácie treba doplniť backend, serverless funkciu alebo externú formulárovú službu.
