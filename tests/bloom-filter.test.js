import test from 'node:test';
import assert from 'node:assert/strict';

import { BloomFilter } from '../js/core/bloom-filter.js';

test('inserted values never become false negatives', () => {
  const filter = new BloomFilter({ bits: 2048, hashes: 5, seed: 42 });
  const values = Array.from({ length: 200 }, (_, index) => `event-${index}`);

  values.forEach((value) => filter.add(value));

  for (const value of values) {
    assert.equal(filter.has(value), true, value);
  }
});

test('inspection returns one bounded position per hash', () => {
  const filter = new BloomFilter({ bits: 128, hashes: 4, seed: 7 });
  const inspection = filter.inspect('dark-matter');

  assert.equal(inspection.indices.length, 4);
  assert.ok(inspection.indices.every((index) => index >= 0 && index < 128));
  assert.equal(new Set(inspection.indices).size, inspection.indices.length);
});

test('metrics remain finite as values are inserted', () => {
  const filter = new BloomFilter({ bits: 1024, hashes: 4 });
  for (let index = 0; index < 100; index += 1) filter.add(`value-${index}`);

  assert.equal(filter.insertedCount, 100);
  assert.ok(filter.setBitCount > 0);
  assert.ok(filter.fillRatio > 0 && filter.fillRatio < 1);
  assert.ok(Number.isFinite(filter.estimatedFalsePositiveRate));
  assert.equal(filter.byteSize, 128);
});

test('clear resets membership and metrics', () => {
  const filter = new BloomFilter({ bits: 256, hashes: 3 });
  filter.add('probably');
  assert.equal(filter.has('probably'), true);

  filter.clear();

  assert.equal(filter.has('probably'), false);
  assert.equal(filter.insertedCount, 0);
  assert.equal(filter.setBitCount, 0);
  assert.equal(filter.fillRatio, 0);
});
