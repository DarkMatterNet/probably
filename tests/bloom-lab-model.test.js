import test from 'node:test';
import assert from 'node:assert/strict';

import { BloomFilter } from '../js/core/bloom-filter.js';
import { deriveBloomConfig, findFalsePositive } from '../js/ui/bloom-lab.js';

test('Bloom lab maps memory bytes to a safe bit and hash configuration', () => {
  assert.deepEqual(deriveBloomConfig(256, 0, 4), { bits: 2048, hashes: 4, byteSize: 256 });
  assert.deepEqual(deriveBloomConfig(64 * 1024, 5000, 99), { bits: 524288, hashes: 8, byteSize: 65536 });
  assert.equal(deriveBloomConfig(1024, 400).hashes, 8);
  assert.equal(deriveBloomConfig(1024, 10).hashes, 8);
});

test('false-positive challenge finds a deterministic value outside exact history', () => {
  const filter = new BloomFilter({ bits: 64, hashes: 3, seed: 7 });
  const exact = new Set();
  for (let index = 0; index < 40; index += 1) {
    const value = `inserted-${index}`;
    exact.add(value);
    filter.add(value);
  }

  const first = findFalsePositive(filter, exact, 42, 5000);
  const second = findFalsePositive(filter, exact, 42, 5000);

  assert.equal(first, second);
  assert.ok(first);
  assert.equal(exact.has(first), false);
  assert.equal(filter.has(first), true);
});

test('false-positive challenge returns null when no candidate matches', () => {
  const filter = new BloomFilter({ bits: 2048, hashes: 4, seed: 7 });
  assert.equal(findFalsePositive(filter, new Set(), 1, 20), null);
});
