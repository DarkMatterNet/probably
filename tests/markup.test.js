import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('page exposes one clear heading and all experiment landmarks', () => {
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  for (const text of ['Bloom Filter', 'HyperLogLog', 'Count-Min Sketch']) {
    assert.ok(html.includes(text), text);
  }
  for (const id of ['memory-budget', 'hero-canvas', 'bloom-root', 'hll-root', 'cms-root', 'share-button', 'toast-region']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), id);
  }
});

test('page is accessible and explicit about local processing', () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /Everything runs locally/i);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<script type="module" src="\.\/js\/app\.js"><\/script>/);
});

test('metadata is suitable for a public portfolio project', () => {
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="description"/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /DarkMatterNet/);
});
