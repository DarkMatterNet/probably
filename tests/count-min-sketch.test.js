import test from 'node:test';
import assert from 'node:assert/strict';

import { CountMinSketch } from '../js/core/count-min-sketch.js';

test('estimated counts never undershoot exact counts', () => {
  const sketch = new CountMinSketch({ width: 32, depth: 4, seed: 99 });
  const exact = new Map();
  const stream = ['react', 'data', 'react', 'web', 'react', 'data', 'open-source'];

  for (const value of stream) {
    sketch.add(value);
    exact.set(value, (exact.get(value) ?? 0) + 1);
  }

  for (const [value, count] of exact) {
    assert.ok(sketch.estimate(value) >= count, value);
  }
});

test('weighted increments accumulate and update total count', () => {
  const sketch = new CountMinSketch({ width: 64, depth: 3 });
  sketch.add('probably', 4);
  sketch.add('probably', 3);

  assert.ok(sketch.estimate('probably') >= 7);
  assert.equal(sketch.totalCount, 7);
});

test('inspection returns one bounded cell per row', () => {
  const sketch = new CountMinSketch({ width: 24, depth: 5, seed: 7 });
  sketch.add('dark-matter');
  const inspection = sketch.inspect('dark-matter');

  assert.equal(inspection.cells.length, 5);
  assert.ok(inspection.cells.every(({ row, column, value }) => (
    row >= 0 && row < 5 && column >= 0 && column < 24 && value >= 1
  )));
  assert.equal(inspection.estimate, Math.min(...inspection.cells.map((cell) => cell.value)));
  assert.equal(sketch.byteSize, 24 * 5 * 4);
});

test('clear resets counters and totals', () => {
  const sketch = new CountMinSketch({ width: 16, depth: 4 });
  sketch.add('one', 5);
  sketch.clear();

  assert.equal(sketch.estimate('one'), 0);
  assert.equal(sketch.totalCount, 0);
  assert.ok(sketch.matrix.every((value) => value === 0));
});
