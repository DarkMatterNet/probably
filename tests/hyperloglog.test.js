import test from 'node:test';
import assert from 'node:assert/strict';

import { HyperLogLog } from '../js/core/hyperloglog.js';

test('an empty sketch estimates zero', () => {
  const sketch = new HyperLogLog({ precision: 10 });
  assert.equal(sketch.estimate(), 0);
});

test('adding duplicates does not change cardinality state', () => {
  const sketch = new HyperLogLog({ precision: 10, seed: 42n });
  sketch.add('same-event');
  const before = sketch.registers;
  const estimateBefore = sketch.estimate();

  for (let index = 0; index < 100; index += 1) sketch.add('same-event');

  assert.deepEqual(sketch.registers, before);
  assert.equal(sketch.estimate(), estimateBefore);
});

test('inspection is deterministic and stays inside register bounds', () => {
  const sketch = new HyperLogLog({ precision: 8, seed: 9n });
  const first = sketch.inspect('dark-matter');
  const second = sketch.inspect('dark-matter');

  assert.deepEqual(first, second);
  assert.match(first.hashHex, /^[0-9a-f]{16}$/);
  assert.ok(first.index >= 0 && first.index < sketch.registerCount);
  assert.ok(first.rank >= 1 && first.rank <= 57);
});

test('ten thousand unique values estimate within twelve percent at precision twelve', () => {
  const sketch = new HyperLogLog({ precision: 12, seed: 2026n });
  for (let index = 0; index < 10_000; index += 1) sketch.add(`user-${index}`);

  const relativeError = Math.abs(sketch.estimate() - 10_000) / 10_000;
  assert.ok(relativeError < 0.12, `relative error was ${relativeError}`);
  assert.equal(sketch.registerCount, 4096);
  assert.equal(sketch.byteSize, 4096);
  assert.ok(sketch.standardError < 0.02);
});

test('clear resets all registers', () => {
  const sketch = new HyperLogLog({ precision: 6 });
  sketch.add('one');
  sketch.clear();
  assert.equal(sketch.estimate(), 0);
  assert.ok(sketch.registers.every((value) => value === 0));
});
