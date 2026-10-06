import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('admin work stages describe RÚVZ notification, not an individual RÚVZ permit', async () => {
  const source = await readFile(new URL('../app/admin/(protected)/zakazky/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /Oznámenie plánovaných prác RÚVZ a súvisiace podklady sú odoslané/);
  assert.match(source, /prípadné rozhodnutia podľa konkrétnej zákazky/);
  assert.doesNotMatch(source, /Žiadosť RÚVZ a OÚ ŽP je podaná/);
  assert.doesNotMatch(source, /Úrady sú schválené/);
});
