import { createRng } from '../core/random.js';

export const CMS_TRAFFIC_PRESET = Object.freeze([
  Object.freeze({ term: 'react', weight: 0.24 }),
  Object.freeze({ term: 'javascript', weight: 0.18 }),
  Object.freeze({ term: 'data', weight: 0.14 }),
  Object.freeze({ term: 'web', weight: 0.11 }),
  Object.freeze({ term: 'open-source', weight: 0.085 }),
  Object.freeze({ term: 'typescript', weight: 0.065 }),
  Object.freeze({ term: 'css', weight: 0.05 }),
  Object.freeze({ term: 'node', weight: 0.04 }),
  Object.freeze({ term: 'api', weight: 0.03 }),
  Object.freeze({ term: 'performance', weight: 0.025 }),
  Object.freeze({ term: 'accessibility', weight: 0.02 }),
  Object.freeze({ term: 'github', weight: 0.015 }),
]);

export const CMS_TERMS = Object.freeze(CMS_TRAFFIC_PRESET.map(({ term }) => term));

export function createWeightedTermStream(seed = 1, preset = CMS_TRAFFIC_PRESET) {
  const rng = createRng(Number(seed) || 1);
  const totalWeight = preset.reduce((total, item) => total + item.weight, 0);

  return function next() {
    let cursor = rng() * totalWeight;
    for (const item of preset) {
      cursor -= item.weight;
      if (cursor <= 0) return item.term;
    }
    return preset.at(-1).term;
  };
}
