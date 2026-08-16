import { clamp } from './format.js';
import { hash64 } from './hash.js';

const UINT64_MASK = 0xffffffffffffffffn;

function mix64(value) {
  let mixed = value & UINT64_MASK;
  mixed = ((mixed ^ (mixed >> 30n)) * 0xbf58476d1ce4e5b9n) & UINT64_MASK;
  mixed = ((mixed ^ (mixed >> 27n)) * 0x94d049bb133111ebn) & UINT64_MASK;
  return (mixed ^ (mixed >> 31n)) & UINT64_MASK;
}

function alphaFor(registerCount) {
  if (registerCount === 16) return 0.673;
  if (registerCount === 32) return 0.697;
  if (registerCount === 64) return 0.709;
  return 0.7213 / (1 + 1.079 / registerCount);
}

function rankOf(remainder, bitCount) {
  if (remainder === 0n) return bitCount + 1;
  return bitCount - remainder.toString(2).length + 1;
}

export class HyperLogLog {
  #precision;
  #registers;
  #seed;

  constructor({ precision = 10, seed = 0n } = {}) {
    this.#precision = clamp(Math.floor(Number(precision) || 10), 4, 14);
    this.#registers = new Uint8Array(2 ** this.#precision);
    this.#seed = BigInt(seed);
  }

  get precision() {
    return this.#precision;
  }

  get registerCount() {
    return this.#registers.length;
  }

  get byteSize() {
    return this.#registers.byteLength;
  }

  get standardError() {
    return 1.04 / Math.sqrt(this.registerCount);
  }

  get registers() {
    return this.#registers.slice();
  }

  inspect(value) {
    const hash = mix64(hash64(String(value), this.#seed));
    const remainderBits = 64 - this.#precision;
    const index = Number(hash >> BigInt(remainderBits));
    const remainderMask = (1n << BigInt(remainderBits)) - 1n;
    const remainder = hash & remainderMask;
    const rank = rankOf(remainder, remainderBits);

    return {
      hashHex: hash.toString(16).padStart(16, '0'),
      index,
      rank,
      changed: rank > this.#registers[index],
    };
  }

  add(value) {
    const inspection = this.inspect(value);
    if (inspection.changed) this.#registers[inspection.index] = inspection.rank;
    return inspection;
  }

  estimate() {
    const registerCount = this.registerCount;
    let harmonicSum = 0;
    let zeroCount = 0;

    for (const register of this.#registers) {
      harmonicSum += 2 ** -register;
      if (register === 0) zeroCount += 1;
    }

    let estimate = (alphaFor(registerCount) * registerCount * registerCount) / harmonicSum;

    if (estimate <= 2.5 * registerCount && zeroCount > 0) {
      estimate = registerCount * Math.log(registerCount / zeroCount);
    }

    return estimate;
  }

  clear() {
    this.#registers.fill(0);
  }
}
