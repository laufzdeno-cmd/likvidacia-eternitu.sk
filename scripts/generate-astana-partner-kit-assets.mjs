import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const outputDirectory = resolve(root, 'public/downloads/strechari');
const logo = await readFile(resolve(root, 'public/assets/astana-logo-print.png'));
const logoDataUri = `data:image/png;base64,${logo.toString('base64')}`;

const escapedLogo = logoDataUri.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const markup = (background) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title description">
  <title id="title">Spolupracujeme s ASTANA</title>
  <desc id="description">Partner pre odborné odstránenie azbestu</desc>
  ${background ? '<rect width="1200" height="630" fill="#fff"/>' : ''}
  <rect x="6" y="6" width="1188" height="618" rx="34" fill="${background ? '#fff' : '#ffffff00'}" stroke="#dce7ec" stroke-width="6"/>
  <rect x="58" y="67" width="19" height="497" rx="10" fill="#9b1749"/>
  <image href="${escapedLogo}" x="126" y="103" width="430" height="129" preserveAspectRatio="xMinYMid meet"/>
  <text x="126" y="327" fill="#193858" font-family="Arial, sans-serif" font-size="55" font-weight="800" letter-spacing="2">SPOLUPRACUJEME S ASTANA</text>
  <text x="126" y="397" fill="#9b1749" font-family="Arial, sans-serif" font-size="31" font-weight="800" letter-spacing="4">ODSTRAŇOVANIE AZBESTU</text>
  <line x1="126" y1="440" x2="1082" y2="440" stroke="#cddfe7" stroke-width="4"/>
  <text x="126" y="497" fill="#516a86" font-family="Arial, sans-serif" font-size="29">Partner pre odborné odstránenie azbestu</text>
</svg>`;

await mkdir(outputDirectory, { recursive: true });
const svg = markup(true);
await writeFile(resolve(outputDirectory, 'astana-partner-badge.svg'), svg, 'utf8');
await sharp(Buffer.from(markup(false))).png().toFile(resolve(outputDirectory, 'astana-partner-badge-transparent.png'));
await sharp(Buffer.from(svg)).png().toFile(resolve(outputDirectory, 'astana-partner-badge-white.png'));
