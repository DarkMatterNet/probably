# Probably Interactive Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a polished, zero-dependency GitHub Pages experience that visualizes Bloom Filter, HyperLogLog, and Count-Min Sketch under one shared memory budget.

**Architecture:** The project is a static ES-module application. Pure algorithm modules live under `js/core`, UI controllers under `js/ui`, and the page shell remains semantic HTML/CSS. Continuous visual effects use Canvas while inspectable structures use DOM elements; URL state and deterministic seeded data make every demo reproducible.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Canvas 2D, Node.js built-in test runner, GitHub Actions, GitHub Pages.

## Global Constraints

- Public repository: `DarkMatterNet/probably`.
- Deployment URL: `https://darkmatternet.github.io/probably/`.
- No backend, uploads, accounts, cookies, analytics, or runtime package CDN.
- No production dependencies.
- All algorithms execute locally in the browser.
- Memory budget: 256 B through 64 KB on a logarithmic scale.
- Support `prefers-reduced-motion`, keyboard navigation, mobile layout, and stateful share URLs.
- Visual direction: technical editorial minimalism, open layouts, acid-lime memory state, violet approximation state, coral error state, pale-cyan exact state.

---

## File map

- `index.html`: semantic app shell, visible copy, controls, lab regions, metadata.
- `styles.css`: tokens, layout, interaction states, visualizations, responsive rules.
- `js/app.js`: application state, global controls, lab coordination, URL state.
- `js/core/hash.js`: seeded 32-bit and 64-bit deterministic hashing.
- `js/core/random.js`: deterministic pseudo-random generator and stream helpers.
- `js/core/bloom-filter.js`: Bloom Filter implementation and metrics.
- `js/core/hyperloglog.js`: HyperLogLog implementation and diagnostics.
- `js/core/count-min-sketch.js`: Count-Min Sketch implementation and diagnostics.
- `js/core/format.js`: byte, percent, integer, and clamp helpers.
- `js/data/presets.js`: deterministic words and event presets.
- `js/ui/hero.js`: live exact-versus-probabilistic hero visualization.
- `js/ui/bloom-lab.js`: Bloom controls, bit array, routes, challenge behavior.
- `js/ui/hll-lab.js`: HLL stream, register skyline, and latest-hash inspector.
- `js/ui/cms-lab.js`: Count-Min stream, matrix heatmap, and frequency comparison.
- `js/ui/toast.js`: accessible transient feedback.
- `tests/*.test.js`: algorithm and state behavior tests.
- `scripts/browser-qa.mjs`: dependency-free Chrome DevTools Protocol smoke QA.
- `.github/workflows/pages.yml`: test and Pages deployment workflow.
- `README.md`, `LICENSE`, `manifest.webmanifest`, `assets/favicon.svg`: public project packaging.

---

### Task 1: Deterministic algorithm core

**Files:**
- Create: `package.json`
- Create: `js/core/hash.js`
- Create: `js/core/random.js`
- Create: `js/core/format.js`
- Create: `tests/hash.test.js`

**Interfaces:**
- Produces: `hash32(value: string, seed?: number): number`
- Produces: `hash64(value: string, seed?: bigint): bigint`
- Produces: `createRng(seed: number): () => number`
- Produces: `clamp(value, min, max)`, `formatBytes(bytes)`, `formatPercent(value, digits)`

- [ ] Write `tests/hash.test.js` asserting stability, seed divergence, 64-bit range, and reproducible RNG sequences.
- [ ] Run `node --test tests/hash.test.js` and confirm failure because modules do not exist.
- [ ] Implement the smallest deterministic hash and RNG modules satisfying the tests.
- [ ] Run `node --test tests/hash.test.js` and confirm all tests pass.
- [ ] Commit with `feat: add deterministic hashing and random core`.

### Task 2: Bloom Filter with diagnostics

**Files:**
- Create: `tests/bloom-filter.test.js`
- Create: `js/core/bloom-filter.js`

**Interfaces:**
- Produces: `new BloomFilter({ bits: number, hashes: number, seed?: number })`
- Produces methods: `add(value)`, `has(value)`, `inspect(value)`, `clear()`
- Produces getters: `insertedCount`, `setBitCount`, `fillRatio`, `estimatedFalsePositiveRate`, `byteSize`
- `inspect(value)` returns `{ present: boolean, indices: number[] }`

- [ ] Write tests proving inserted items have no false negatives, inspection returns bounded positions, clearing resets state, and metrics remain finite.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement double-hashing over a packed `Uint8Array` bitset with clamped parameters.
- [ ] Run the Bloom tests and full suite.
- [ ] Commit with `feat: implement bloom filter diagnostics`.

### Task 3: HyperLogLog with step diagnostics

**Files:**
- Create: `tests/hyperloglog.test.js`
- Create: `js/core/hyperloglog.js`

**Interfaces:**
- Produces: `new HyperLogLog({ precision: number, seed?: bigint })`
- Produces methods: `add(value)`, `estimate()`, `inspect(value)`, `clear()`
- Produces getters: `registerCount`, `byteSize`, `standardError`, `registers`
- `inspect(value)` returns `{ hashHex, index, rank, changed }`

- [ ] Write tests for duplicate invariance, deterministic inspection, register bounds, empty estimate, and 10,000-item estimate within 12% at precision 12.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement 64-bit hashing, register indexing, rank extraction, harmonic estimate, and small-range correction.
- [ ] Run HLL tests and full suite.
- [ ] Commit with `feat: implement hyperloglog estimator`.

### Task 4: Count-Min Sketch with collision inspection

**Files:**
- Create: `tests/count-min-sketch.test.js`
- Create: `js/core/count-min-sketch.js`

**Interfaces:**
- Produces: `new CountMinSketch({ width: number, depth: number, seed?: number })`
- Produces methods: `add(value, count?)`, `estimate(value)`, `inspect(value)`, `clear()`
- Produces getters: `byteSize`, `totalCount`, `matrix`
- `inspect(value)` returns `{ estimate, cells: Array<{ row, column, value }> }`

- [ ] Write tests proving estimates never undershoot exact counts, increments accumulate, cells stay in bounds, and clear resets all counters.
- [ ] Run the test and confirm missing-module failure.
- [ ] Implement independent row hashes over a flat `Uint32Array` and minimum estimation.
- [ ] Run Count-Min tests and full suite.
- [ ] Commit with `feat: implement count min sketch`.

### Task 5: Semantic shell and design system

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `assets/favicon.svg`
- Create: `manifest.webmanifest`

**Interfaces:**
- Stable IDs: `memory-budget`, `hero-canvas`, `bloom-root`, `hll-root`, `cms-root`, `share-button`, `toast-region`.

- [ ] Write `tests/markup.test.js` asserting required IDs, one H1, lab headings, privacy copy, skip link, and module script.
- [ ] Run the markup test and confirm it fails because `index.html` is absent.
- [ ] Implement semantic HTML with complete controls.
- [ ] Implement CSS tokens, desktop composition, focus states, visualizations, and responsive rules.
- [ ] Run markup/full tests and syntax checks.
- [ ] Commit with `feat: add probably visual system and shell`.

### Task 6: Shared state and hero experience

**Files:**
- Create: `js/app.js`
- Create: `js/ui/hero.js`
- Create: `js/ui/toast.js`
- Create: `tests/url-state.test.js`

**Interfaces:**
- `parseUrlState(search)` returns `{ memoryBytes, lab, seed }`.
- `serializeUrlState(state)` returns a stable query string.
- `createHero(...)` returns `{ start(), stop(), resize(), setMemory(bytes), destroy() }`.

- [ ] Write URL-state tests for defaults, clamping, supported labs, deterministic serialization, and invalid input.
- [ ] Run URL-state tests and confirm missing exports.
- [ ] Implement URL state, logarithmic memory mapping, navigation, share behavior, and reduced motion.
- [ ] Implement the hero Canvas and live metrics.
- [ ] Run tests and syntax checks.
- [ ] Commit with `feat: add shared memory state and live hero`.

### Task 7: Bloom interactive lab

**Files:**
- Create: `js/ui/bloom-lab.js`
- Create: `tests/bloom-lab-model.test.js`

**Interfaces:**
- `createBloomLab(...)` returns `{ setMemory(bytes), reset(), destroy() }`.
- `deriveBloomConfig(memoryBytes, insertedCount, requestedHashes)` returns safe configuration.
- `findFalsePositive(filter, exactSet, seed)` returns a deterministic candidate or `null`.

- [ ] Write model tests for memory mapping and deterministic challenge search.
- [ ] Run tests and confirm missing exports.
- [ ] Implement custom insert/query, sample insertion, reset, challenge, hash routes, bit array, and metrics.
- [ ] Add accessible status copy for every result state.
- [ ] Run tests/syntax checks.
- [ ] Commit with `feat: build bloom filter playground`.

### Task 8: HyperLogLog interactive lab

**Files:**
- Create: `js/ui/hll-lab.js`
- Create: `tests/hll-lab-model.test.js`

**Interfaces:**
- `createHllLab(...)` returns `{ setMemory(bytes), reset(), destroy() }`.
- `deriveHllPrecision(memoryBytes)` returns 4 through 14.

- [ ] Write model tests for precision mapping and deterministic stream generation.
- [ ] Run tests and confirm missing exports.
- [ ] Implement step, play/pause, duplicate injection, exact comparison, hash inspector, and register skyline.
- [ ] Ensure animation runs only while needed.
- [ ] Run tests/syntax checks.
- [ ] Commit with `feat: build hyperloglog playground`.

### Task 9: Count-Min Sketch interactive lab

**Files:**
- Create: `js/data/presets.js`
- Create: `js/ui/cms-lab.js`
- Create: `tests/cms-lab-model.test.js`

**Interfaces:**
- `createCmsLab(...)` returns `{ setMemory(bytes), reset(), destroy() }`.
- `deriveCmsConfig(memoryBytes, depth)` returns `{ width, depth, byteSize }`.
- `createZipfStream(seed)` returns a deterministic event generator.

- [ ] Write model tests for memory mapping, reproducibility, and bounded vocabulary output.
- [ ] Run tests and confirm missing exports.
- [ ] Implement play/pause, step, reset, query, exact map, matrix heatmap, collision trace, and ranked rows.
- [ ] Expose text equivalents for selected heatmap cells.
- [ ] Run tests/syntax checks.
- [ ] Commit with `feat: build count min sketch playground`.

### Task 10: Browser QA, documentation, and deployment

**Files:**
- Create: `scripts/browser-qa.mjs`
- Create: `.github/workflows/pages.yml`
- Create: `README.md`
- Create: `LICENSE`
- Modify: `package.json`

**Interfaces:**
- `npm test` runs all Node tests.
- `npm run check` syntax-checks all JavaScript modules.
- `npm run qa:browser` uses Chromium/CDP, checks the core workflow, and writes desktop/mobile screenshots.

- [ ] Implement browser QA with failures for missing content, console exceptions, inert controls, overflow, or screenshot errors.
- [ ] Run local server and browser QA; inspect and repair desktop/mobile screenshots.
- [ ] Add a Pages workflow gated by tests and syntax checks.
- [ ] Write a portfolio-grade README and MIT license.
- [ ] Run all clean-tree verification commands.
- [ ] Commit with `chore: document test and deploy probably`.
- [ ] Publish a feature branch, open and merge a pull request, then verify Pages.
