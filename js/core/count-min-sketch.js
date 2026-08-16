import { clamp } from './format.js';
import { hash32 } from './hash.js';

const MAX_COUNTER = 0xffffffff;

export class CountMinSketch {
  #width;
  #depth;
  #seed;
  #counters;
  #totalCount = 0;

  constructor({ width = 256, depth = 4, seed = 0 } = {}) {
    this.#width = clamp(Math.floor(Number(width) || 1), 1, 1_000_000);
    this.#depth = clamp(Math.floor(Number(depth) || 1), 1, 16);
    this.#seed = Number(seed) >>> 0;
    this.#counters = new Uint32Array(this.#width * this.#depth);
  }

  get width() {
    return this.#width;
  }

  get depth() {
    return this.#depth;
  }

  get byteSize() {
    return this.#counters.byteLength;
  }

  get totalCount() {
    return this.#totalCount;
  }

  get matrix() {
    return this.#counters.slice();
  }

  add(value, count = 1) {
    const increment = clamp(Math.floor(Number(count) || 1), 1, MAX_COUNTER);
    const cells = this.#cellsFor(String(value));

    for (const cell of cells) {
      const offset = cell.row * this.#width + cell.column;
      const next = Math.min(MAX_COUNTER, this.#counters[offset] + increment);
      this.#counters[offset] = next;
    }

    this.#totalCount += increment;
    return this.inspect(value);
  }

  estimate(value) {
    return this.inspect(value).estimate;
  }

  inspect(value) {
    const cells = this.#cellsFor(String(value)).map(({ row, column }) => ({
      row,
      column,
      value: this.#counters[row * this.#width + column],
    }));

    return {
      estimate: Math.min(...cells.map((cell) => cell.value)),
      cells,
    };
  }

  clear() {
    this.#counters.fill(0);
    this.#totalCount = 0;
  }

  #cellsFor(value) {
    const cells = [];
    for (let row = 0; row < this.#depth; row += 1) {
      const rowSeed = (this.#seed + Math.imul(row + 1, 0x9e3779b1)) >>> 0;
      cells.push({
        row,
        column: hash32(value, rowSeed) % this.#width,
      });
    }
    return cells;
  }
}
