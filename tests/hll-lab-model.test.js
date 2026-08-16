import test from 'node:test';
import assert from 'node:assert/strict';

import { createHllStream, deriveHllPrecision } from '../js/ui/hll-lab.js';

test('HLL lab maps memory to a power-of-two register precision', () => {
  assert.equal(deriveHllPrecision(256), 8);
  assert.equal(deriveHllPrecision(4096), 12);
  assert.equal(deriveHllPrecision(64 * 1024), 14);
  assert.equal(deriveHllPrecision(1), 4);
});

test('HLL streams are deterministic for the same seed', () => {
  const first = createHllStream(42);
  const second = createHllStream(42);
  const a = Array.from({ length: 20 }, () => first());
  const b = Array.from({ length: 20 }, () => second());

  assert.deepEqual(a, b);
  assert.ok(a.every((value) => /^visitor-[a-z0-9]+$/.test(value)));
});

test('HLL streams diverge for different seeds and include duplicates', () => {
  const first = createHllStream(1);
  const second = createHllStream(2);
  const a = Array.from({ length: 500 }, () => first());
  const b = Array.from({ length: 500 }, () => second());

  assert.notDeepEqual(a, b);
  assert.ok(new Set(a).size < a.length);
});
