import { BloomFilter } from '../core/bloom-filter.js';
import { clamp, formatInteger, formatPercent } from '../core/format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DISPLAY_CELLS = 512;

export function deriveBloomConfig(memoryBytes, insertedCount = 0, requestedHashes) {
  const byteSize = clamp(Math.round(Number(memoryBytes) || 256), 256, 65536);
  const bits = byteSize * 8;
  const optimal = Math.round((bits / Math.max(1, Number(insertedCount) || 1)) * Math.LN2);
  const hashes = clamp(
    requestedHashes == null ? optimal : Math.round(Number(requestedHashes) || 1),
    1,
    8,
  );
  return { bits, hashes, byteSize };
}

export function findFalsePositive(filter, exactSet, seed = 1, maxAttempts = 100_000) {
  for (let index = 0; index < maxAttempts; index += 1) {
    const candidate = `candidate-${seed}-${index.toString(36)}`;
    if (!exactSet.has(candidate) && filter.has(candidate)) return candidate;
  }
  return null;
}

export function createBloomLab({ root, memoryBytes = 4096, seed = 1, announce = () => {} }) {
  if (!root) return { setMemory() {}, reset() {}, destroy() {} };

  const elements = {
    insertInput: root.querySelector('#bloom-insert-input'),
    insertButton: root.querySelector('#bloom-insert-button'),
    sampleButton: root.querySelector('#bloom-sample-button'),
    resetButton: root.querySelector('#bloom-reset-button'),
    queryInput: root.querySelector('#bloom-query-input'),
    queryButton: root.querySelector('#bloom-query-button'),
    challengeButton: root.querySelector('#bloom-challenge-button'),
    result: root.querySelector('#bloom-result'),
    route: root.querySelector('#bloom-route'),
    routeSvg: root.querySelector('#bloom-route svg'),
    routeToken: root.querySelector('#bloom-route .route-token'),
    bitField: root.querySelector('#bloom-bits'),
    bitDescription: root.querySelector('#bloom-bit-description'),
    bitLabel: root.querySelector('#bloom-bit-label'),
    elementMetric: root.querySelector('#bloom-elements'),
    fillMetric: root.querySelector('#bloom-fill'),
    fprMetric: root.querySelector('#bloom-fpr'),
    hashMetric: root.querySelector('#bloom-hashes'),
  };

  const abortController = new AbortController();
  const exactSet = new Set();
  const bitCells = [];
  let currentMemory = memoryBytes;
  let filter;
  let sampleIndex = 0;
  let lastValue = '';
  let lastIndices = [];

  function createBitCells() {
    elements.bitField.replaceChildren();
    bitCells.length = 0;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < DISPLAY_CELLS; index += 1) {
      const cell = document.createElement('span');
      cell.className = 'bit-cell';
      cell.setAttribute('aria-hidden', 'true');
      fragment.append(cell);
      bitCells.push(cell);
    }
    elements.bitField.append(fragment);
  }

  function rebuildFilter() {
    const config = deriveBloomConfig(currentMemory, exactSet.size, 4);
    filter = new BloomFilter({ bits: config.bits, hashes: config.hashes, seed });
    for (const value of exactSet) filter.add(value);
    render();
  }

  function setResult(state, title, detail) {
    elements.result.dataset.state = state;
    elements.result.querySelector('strong').textContent = title;
    elements.result.querySelector('p').textContent = detail;
  }

  function displayBuckets() {
    const active = new Set();
    const bytes = filter.bitArray;
    for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
      const byte = bytes[byteIndex];
      if (byte === 0) continue;
      for (let bit = 0; bit < 8; bit += 1) {
        if ((byte & (1 << bit)) === 0) continue;
        const actualIndex = byteIndex * 8 + bit;
        if (actualIndex >= filter.bitCount) continue;
        active.add(Math.min(DISPLAY_CELLS - 1, Math.floor((actualIndex / filter.bitCount) * DISPLAY_CELLS)));
      }
    }
    return active;
  }

  function renderRoute(value, indices) {
    elements.routeSvg.replaceChildren();
    elements.routeToken.textContent = value || 'Waiting for a value';
    elements.routeToken.title = value || '';
    if (!indices.length) return;

    const startX = 500;
    const startY = 58;
    for (const index of indices) {
      const targetX = 28 + (index / Math.max(1, filter.bitCount - 1)) * 944;
      const targetY = 210;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M ${startX} ${startY} C ${startX} 118, ${targetX} 118, ${targetX} ${targetY}`);
      elements.routeSvg.append(path);

      const marker = document.createElementNS(SVG_NS, 'circle');
      marker.setAttribute('cx', String(targetX));
      marker.setAttribute('cy', String(targetY));
      marker.setAttribute('r', '3.2');
      elements.routeSvg.append(marker);
    }
  }

  function renderBits() {
    const activeBuckets = displayBuckets();
    const hitBuckets = new Set(lastIndices.map((index) => (
      Math.min(DISPLAY_CELLS - 1, Math.floor((index / filter.bitCount) * DISPLAY_CELLS))
    )));

    bitCells.forEach((cell, index) => {
      cell.classList.toggle('is-set', activeBuckets.has(index));
      cell.classList.toggle('is-hit', hitBuckets.has(index));
    });
  }

  function renderMetrics() {
    elements.elementMetric.textContent = formatInteger(exactSet.size);
    elements.fillMetric.textContent = formatPercent(filter.fillRatio, 1);
    elements.fprMetric.textContent = formatPercent(filter.estimatedFalsePositiveRate, filter.estimatedFalsePositiveRate < 0.001 ? 3 : 2);
    elements.hashMetric.textContent = String(filter.hashCount);
    elements.bitLabel.textContent = `${formatInteger(filter.bitCount)} bits`;
    elements.bitDescription.textContent = `${formatInteger(filter.setBitCount)} of ${formatInteger(filter.bitCount)} bits are set. ${lastIndices.length} positions are highlighted.`;
  }

  function render() {
    renderMetrics();
    renderBits();
    renderRoute(lastValue, lastIndices);
  }

  function inspectValue(rawValue, shouldAnnounce = true) {
    const value = String(rawValue).trim().slice(0, 80);
    if (!value) {
      setResult('empty', 'Enter a value first', 'The filter needs a non-empty string to hash.');
      if (shouldAnnounce) announce('Enter a value before querying.');
      return;
    }

    const inspection = filter.inspect(value);
    const exact = exactSet.has(value);
    lastValue = value;
    lastIndices = inspection.indices;

    if (!inspection.present) {
      setResult('negative', 'Definitely not', 'At least one required bit is missing, so this value was never inserted.');
      if (shouldAnnounce) announce(`${value}: definitely not present.`);
    } else if (exact) {
      setResult('positive', 'Probably yes', 'Every required bit is set. Exact history confirms this value was inserted.');
      if (shouldAnnounce) announce(`${value}: probably present, confirmed by exact history.`);
    } else {
      setResult('false-positive', 'False positive found', 'Every required bit is set, but exact history proves this value was never inserted.');
      if (shouldAnnounce) announce(`${value}: false positive found.`);
    }
    render();
  }

  function insertValue(rawValue, shouldAnnounce = true) {
    const value = String(rawValue).trim().slice(0, 80);
    if (!value) {
      setResult('empty', 'Enter a value first', 'The filter needs a non-empty string to insert.');
      if (shouldAnnounce) announce('Enter a value before inserting.');
      return;
    }
    const alreadyPresent = exactSet.has(value);
    if (!alreadyPresent) {
      exactSet.add(value);
      lastIndices = filter.add(value);
    } else {
      lastIndices = filter.inspect(value).indices;
    }
    lastValue = value;
    elements.queryInput.value = value;
    inspectValue(value, false);
    if (shouldAnnounce) announce(alreadyPresent ? `${value} was already in the filter.` : `${value} inserted.`);
  }

  function addSamples(count = 25, shouldAnnounce = true) {
    for (let index = 0; index < count; index += 1) {
      const value = `visitor-${seed.toString(36)}-${sampleIndex.toString(36)}`;
      sampleIndex += 1;
      if (exactSet.has(value)) continue;
      exactSet.add(value);
      lastIndices = filter.add(value);
      lastValue = value;
    }
    inspectValue(lastValue, false);
    if (shouldAnnounce) announce(`${count} sample values added.`);
  }

  function challenge() {
    const target = Math.min(45_000, Math.max(120, Math.ceil(filter.bitCount * 0.17)));
    if (exactSet.size < target) addSamples(target - exactSet.size, false);
    const candidate = findFalsePositive(filter, exactSet, seed ^ exactSet.size, 150_000);
    if (!candidate) {
      setResult('empty', 'No false positive yet', 'Reduce the memory budget or add more samples, then try again.');
      announce('No false positive found at this memory budget.');
      render();
      return;
    }
    elements.queryInput.value = candidate;
    inspectValue(candidate, true);
  }

  function reset() {
    exactSet.clear();
    sampleIndex = 0;
    lastValue = '';
    lastIndices = [];
    rebuildFilter();
    setResult('empty', 'Insert or query a value', 'The hash paths will appear in the bit field.');
    announce('Bloom Filter reset.');
  }

  function setMemory(bytes) {
    const next = clamp(Math.round(Number(bytes) || 4096), 256, 65536);
    if (next === currentMemory) return;
    currentMemory = next;
    rebuildFilter();
    if (lastValue) inspectValue(lastValue, false);
  }

  const { signal } = abortController;
  elements.insertButton.addEventListener('click', () => insertValue(elements.insertInput.value), { signal });
  elements.queryButton.addEventListener('click', () => inspectValue(elements.queryInput.value), { signal });
  elements.sampleButton.addEventListener('click', () => addSamples(25), { signal });
  elements.resetButton.addEventListener('click', reset, { signal });
  elements.challengeButton.addEventListener('click', challenge, { signal });
  elements.insertInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') insertValue(elements.insertInput.value);
  }, { signal });
  elements.queryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') inspectValue(elements.queryInput.value);
  }, { signal });

  createBitCells();
  rebuildFilter();
  insertValue(elements.insertInput.value, false);

  return {
    setMemory,
    reset,
    destroy() {
      abortController.abort();
    },
  };
}
