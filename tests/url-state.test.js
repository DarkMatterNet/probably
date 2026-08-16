import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MEMORY_OPTIONS,
  memoryBytesToIndex,
  memoryIndexToBytes,
  parseUrlState,
  serializeUrlState,
} from '../js/app.js';

test('URL state uses safe defaults', () => {
  assert.deepEqual(parseUrlState(''), {
    memoryBytes: 4096,
    lab: 'overview',
    seed: 20260815,
  });
});

test('URL state snaps memory to the nearest supported budget', () => {
  assert.equal(parseUrlState('?memory=3000').memoryBytes, 2048);
  assert.equal(parseUrlState('?memory=9999999').memoryBytes, 65536);
  assert.equal(parseUrlState('?memory=-4').memoryBytes, 256);
});

test('URL state rejects unknown labs and unsafe seeds', () => {
  assert.equal(parseUrlState('?lab=unknown').lab, 'overview');
  assert.equal(parseUrlState('?lab=count-min').lab, 'count-min');
  assert.equal(parseUrlState('?seed=nope').seed, 20260815);
  assert.equal(parseUrlState('?seed=17').seed, 17);
});

test('serialization is stable and URL encoded', () => {
  assert.equal(
    serializeUrlState({ memoryBytes: 8192, lab: 'hyperloglog', seed: 42 }),
    '?memory=8192&lab=hyperloglog&seed=42',
  );
});

test('memory slider mappings round-trip all supported values', () => {
  MEMORY_OPTIONS.forEach((bytes, index) => {
    assert.equal(memoryIndexToBytes(index), bytes);
    assert.equal(memoryBytesToIndex(bytes), index);
  });
});
