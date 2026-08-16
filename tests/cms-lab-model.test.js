import test from 'node:test';
import assert from 'node:assert/strict';

import { CMS_TERMS, createCmsStream, deriveCmsConfig } from '../js/ui/cms-lab.js';

test('Count-Min lab converts memory into a four-row Uint32 matrix', () => {
  assert.deepEqual(deriveCmsConfig(256), { width: 16, depth: 4, byteSize: 256 });
  assert.deepEqual(deriveCmsConfig(4096), { width: 256, depth: 4, byteSize: 4096 });
  assert.deepEqual(deriveCmsConfig(64 * 1024), { width: 4096, depth: 4, byteSize: 64 * 1024 });
});

test('Count-Min streams are reproducible and use the public vocabulary', () => {
  const first = createCmsStream(19);
  const second = createCmsStream(19);
  const a = Array.from({ length: 200 }, () => first());
  const b = Array.from({ length: 200 }, () => second());

  assert.deepEqual(a, b);
  assert.ok(a.every((term) => CMS_TERMS.includes(term)));
});

test('Count-Min demo stream is intentionally skewed', () => {
  const next = createCmsStream(29);
  const counts = new Map(CMS_TERMS.map((term) => [term, 0]));
  for (let index = 0; index < 10_000; index += 1) {
    const term = next();
    counts.set(term, counts.get(term) + 1);
  }

  assert.ok(counts.get('react') > counts.get('github'));
  assert.ok(counts.get('javascript') > counts.get('accessibility'));
});
