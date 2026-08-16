const encoder = new TextEncoder();
const UINT64_MASK = 0xffffffffffffffffn;
const FNV32_OFFSET = 0x811c9dc5;
const FNV32_PRIME = 0x01000193;
const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;

export function hash32(value, seed = 0) {
  let hash = (FNV32_OFFSET ^ (seed >>> 0)) >>> 0;
  const bytes = encoder.encode(String(value));

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, FNV32_PRIME) >>> 0;
  }

  return hash >>> 0;
}

export function hash64(value, seed = 0n) {
  let hash = (FNV64_OFFSET ^ (BigInt(seed) & UINT64_MASK)) & UINT64_MASK;
  const bytes = encoder.encode(String(value));

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV64_PRIME) & UINT64_MASK;
  }

  return hash;
}
