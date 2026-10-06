import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { articles } from '../src/content/seo-content';

test('každý článok používa existujúci tematický Open Graph obrázok', async () => {
  assert.equal(articles.length, 8);

  for (const article of articles) {
    assert.match(article.image, /^\/og\/[a-z0-9-]+\.jpg$/);
    await access(path.join(process.cwd(), 'public', article.image.slice(1)));
  }
});

test('článková route odovzdáva vlastný obrázok do metadata helpera', async () => {
  const source = await readFile(path.join(process.cwd(), 'app', 'poradna', '[slug]', 'page.tsx'), 'utf8');
  assert.match(source, /image:\s*article\.image/);
});
