import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sourceFiles = [
  'src/font-face.css',
  'src/styles.css',
  'src/premium-overrides.css',
  'src/final-visual-polish.css',
  'src/responsive-audit-hotfix.css',
  'src/public-header-stability.css',
  'src/article-editorial.css',
  'src/mobile-cookie-layout.css',
];

function normalize(source) {
  return source.replace(/\r\n/g, '\n').trimEnd();
}

test('globálny CSS balík zachováva presné poradie všetkých zdrojových vrstiev', () => {
  const expected = sourceFiles
    .map((file) => normalize(readFileSync(file, 'utf8')))
    .join('\n');
  const actual = normalize(readFileSync('src/global-bundle.css', 'utf8'));

  assert.equal(actual, expected);
});

test('root layout načítava iba jeden globálny CSS vstup', () => {
  const layout = readFileSync('app/layout.tsx', 'utf8');
  const globalCssImports = [...layout.matchAll(/import\s+['"]\.\.\/src\/[^'"]+\.css['"];?/g)]
    .map((match) => match[0]);

  assert.deepEqual(globalCssImports, ["import '../src/global-bundle.css';"]);
  assert.doesNotMatch(readFileSync('src/global-bundle.css', 'utf8'), /^\s*@import\b/m);
});
