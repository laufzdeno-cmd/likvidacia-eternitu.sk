import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { serializeJsonLd } from '../src/lib/json-ld-serialize.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('JSON-LD serialization neutralizes HTML script-breaking characters and preserves JSON data', () => {
  const value = {
    name: '</script><script>globalThis.pwned = true</script>',
    separators: '\u2028\u2029 & > <',
  };
  const serialized = serializeJsonLd(value);

  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/);
  assert.deepEqual(JSON.parse(serialized), value);
  assert.equal((serialized.match(/script/gi) || []).length, 3);
});

test('all JSON-LD script emitters use the shared safe serializer', () => {
  const files = [
    '../app/layout.tsx',
    '../app/page.tsx',
    '../app/realizacie/page.tsx',
    '../app/seo-json-ld.tsx',
  ];

  for (const file of files) {
    const source = read(file);
    assert.match(source, /serializeJsonLd\(/, `${file} must use the shared serializer`);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/);
  }
});

test('article content does not display an invented shared update date', () => {
  assert.doesNotMatch(read('../app/seo-components.tsx'), /Aktualizované: 27\. mája 2026/);
});
