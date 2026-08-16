import { hash32 } from './hash.js';
import { clamp } from './format.js';

export class BloomFilter {
  #bits;
  #hashes;
  #seed;
  #bytes;
  #insertedCount = 0;
  #setBitCount = 0;

  constructor({ bits = 2048, hashes = 4, seed = 0 } = {}) {
    this.#bits = Math.max(8, Math.floor(Number(bits) || 8));
    this.#hashes = clamp(Math.floor(Number(hashes) || 1), 1, Math.min(16, this.#bits));
    this.#seed = Number(seed) >>> 0;
    this.#bytes = new Uint8Array(Math.ceil(this.#bits / 8));
  }

  get bitCount() {
    return this.#bits;
  }

  get hashCount() {
    return this.#hashes;
  }

  get insertedCount() {
    return this.#insertedCount;
  }

  get setBitCount() {
    return this.#setBitCount;
  }

  get fillRatio() {
    return this.#setBitCount / this.#bits;
  }

  get estimatedFalsePositiveRate() {
    const exponent = (-this.#hashes * this.#insertedCount) / this.#bits;
    return (1 - Math.exp(exponent)) ** this.#hashes;
  }

  get byteSize() {
    return this.#bytes.byteLength;
  }

  get bitArray() {
    return this.#bytes.slice();
  }

  add(value) {
    const { indices } = this.inspect(value);
    for (const index of indices) this.#setBit(index, true);
    this.#insertedCount += 1;
    return indices;
  }

  has(value) {
    return this.inspect(value).present;
  }

  inspect(value) {
    const indices = this.#indicesFor(String(value));
    return {
      present: indices.every((index) => this.#getBit(index)),
      indices,
    };
  }

  clear() {
    this.#bytes.fill(0);
    this.#insertedCount = 0;
    this.#setBitCount = 0;
  }

  #indicesFor(value) {
    const first = hash32(value, this.#seed);
    const second = (hash32(value, this.#seed ^ 0x9e3779b9) | 1) >>> 0;
    const seen = new Set();
    const indices = [];

    for (let index = 0; index < this.#hashes; index += 1) {
      let position = (first + Math.imul(index, second)) >>> 0;
      position %= this.#bits;
      while (seen.has(position)) position = (position + 1) % this.#bits;
      seen.add(position);
      indices.push(position);
    }

    return indices;
  }

  #getBit(index) {
    const byteIndex = index >>> 3;
    const mask = 1 << (index & 7);
    return (this.#bytes[byteIndex] & mask) !== 0;
  }

  #setBit(index, enabled) {
    const byteIndex = index >>> 3;
    const mask = 1 << (index & 7);
    const wasSet = (this.#bytes[byteIndex] & mask) !== 0;

    if (enabled && !wasSet) {
      this.#bytes[byteIndex] |= mask;
      this.#setBitCount += 1;
    } else if (!enabled && wasSet) {
      this.#bytes[byteIndex] &= ~mask;
      this.#setBitCount -= 1;
    }
  }
}
