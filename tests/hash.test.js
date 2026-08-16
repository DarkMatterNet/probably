import test from 'node:test';
import assert from 'node:assert/strict';

import { hash32, hash64 } from '../js/core/hash.js';
import { createRng } from '../js/core/random.js';
import { clamp, formatBytes, formatPercent } from '../js/core/format.js';

test('hash32 matches the canonical FNV-1a result for hello', () => {
  assert.equal(hash32('hello'), 0x4f9f2cab);
});

test('hash32 changes when its seed changes', () => {
  assert.notEqual(hash32('probably', 1), hash32('probably', 2));
});

test('hash64 matches the canonical FNV-1a result for hello', () => {
  assert.equal(hash64('hello'), 0xa430d84680aabd0bn);
});

test('hash64 stays inside the unsigned 64-bit range', () => {
  const value = hash64('dark matter', 42n);
  assert.ok(value >= 0n);
  assert.ok(value <= 0xffffffffffffffffn);
});

test('seeded random sequences are reproducible and bounded', () => {
  const first = createRng(2026);
  const second = createRng(2026);
  const valuesA = Array.from({ length: 8 }, () => first());
  const valuesB = Array.from({ length: 8 }, () => second());

  assert.deepEqual(valuesA, valuesB);
  assert.ok(valuesA.every((value) => value >= 0 && value < 1));
});

test('format helpers produce concise UI values', () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(formatBytes(128), '128 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatPercent(0.996, 1), '99.6%');
});
