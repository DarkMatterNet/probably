import { CountMinSketch } from '../core/count-min-sketch.js';
import { clamp, formatInteger, formatPercent } from '../core/format.js';
import { CMS_TERMS, createWeightedTermStream } from '../data/presets.js';

const DEPTH = 4;
const MAX_DISPLAY_COLUMNS = 64;

export { CMS_TERMS } from '../data/presets.js';

export function deriveCmsConfig(memoryBytes, depth = DEPTH) {
  const safeDepth = clamp(Math.floor(Number(depth) || DEPTH), 1, 8);
  const safeBytes = clamp(Math.floor(Number(memoryBytes) || 256), safeDepth * 4, 64 * 1024);
  const width = Math.max(1, Math.floor(safeBytes / (safeDepth * Uint32Array.BYTES_PER_ELEMENT)));
  return {
    width,
    depth: safeDepth,
    byteSize: width * safeDepth * Uint32Array.BYTES_PER_ELEMENT,
  };
}

export function createCmsStream(seed = 1) {
  return createWeightedTermStream(seed);
}

export function createCmsLab({
  root,
  memoryBytes = 4096,
  seed = 1,
  announce = () => {},
  reducedMotion = false,
} = {}) {
  if (!root) return { setMemory() {}, reset() {}, destroy() {} };

  const elements = {
    playButton: root.querySelector('#cms-play-button'),
    playLabel: root.querySelector('#cms-play-button span'),
    playIconPath: root.querySelector('#cms-play-button path'),
    stepButton: root.querySelector('#cms-step-button'),
    resetButton: root.querySelector('#cms-reset-button'),
    status: root.querySelector('#cms-stream-status'),
    querySelect: root.querySelector('#cms-query-select'),
    selectedValue: root.querySelector('#cms-selected-value'),
    selectedExact: root.querySelector('#cms-selected-exact'),
    selectedEstimate: root.querySelector('#cms-selected-estimate'),
    selectedOver: root.querySelector('#cms-selected-over'),
    selectedCells: root.querySelector('#cms-selected-cells'),
    total: root.querySelector('#cms-total'),
    width: root.querySelector('#cms-width'),
    depth: root.querySelector('#cms-depth'),
    worstOver: root.querySelector('#cms-worst-over'),
    matrixLabel: root.querySelector('#cms-matrix-label'),
    latest: root.querySelector('#cms-latest'),
    matrix: root.querySelector('#cms-matrix'),
    ranking: root.querySelector('#cms-ranking'),
  };

  const abortController = new AbortController();
  const exactCounts = new Map(CMS_TERMS.map((term) => [term, 0]));
  const matrixCells = [];
  let currentMemory = clamp(Math.round(Number(memoryBytes) || 4096), 256, 65536);
  let sketch;
  let stream;
  let latestTerm = '';
  let latestInspection = null;
  let running = false;
  let animationFrame = 0;
  let previousFrameTime = 0;
  let observer;
  let displayColumns = 0;

  function populateTerms() {
    const selected = elements.querySelect.value || CMS_TERMS[0];
    const fragment = document.createDocumentFragment();
    for (const term of CMS_TERMS) {
      const option = document.createElement('option');
      option.value = term;
      option.textContent = term;
      option.selected = term === selected;
      fragment.append(option);
    }
    elements.querySelect.replaceChildren(fragment);
    if (!CMS_TERMS.includes(elements.querySelect.value)) elements.querySelect.value = CMS_TERMS[0];
  }

  function createMatrixCells() {
    displayColumns = Math.min(MAX_DISPLAY_COLUMNS, sketch.width);
    elements.matrix.replaceChildren();
    matrixCells.length = 0;
    elements.matrix.style.gridTemplateColumns = `repeat(${displayColumns}, minmax(3px, 1fr))`;
    elements.matrix.style.gridTemplateRows = `repeat(${sketch.depth}, minmax(42px, 1fr))`;

    const fragment = document.createDocumentFragment();
    for (let row = 0; row < sketch.depth; row += 1) {
      for (let column = 0; column < displayColumns; column += 1) {
        const cell = document.createElement('span');
        cell.className = 'counter-cell';
        cell.style.setProperty('--heat', '0');
        cell.setAttribute('aria-hidden', 'true');
        fragment.append(cell);
        matrixCells.push(cell);
      }
    }
    elements.matrix.append(fragment);
  }

  function setPlaybackState(nextRunning) {
    running = Boolean(nextRunning);
    elements.status.textContent = running ? 'Live' : 'Paused';
    elements.status.classList.toggle('is-live', running);
    elements.playLabel.textContent = running ? 'Pause' : 'Play';
    elements.playButton.setAttribute('aria-label', running ? 'Pause traffic stream' : 'Play traffic stream');
    elements.playButton.setAttribute('aria-pressed', String(running));
    elements.playIconPath.setAttribute('d', running ? 'M8 5h3v14H8V5Zm5 0h3v14h-3V5Z' : 'm8 5 11 7-11 7V5Z');
    if (!running && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }

  function rebuildSketch() {
    const config = deriveCmsConfig(currentMemory, DEPTH);
    sketch = new CountMinSketch({ width: config.width, depth: config.depth, seed });
    for (const [term, count] of exactCounts) {
      if (count > 0) sketch.add(term, count);
    }
    latestInspection = latestTerm ? sketch.inspect(latestTerm) : null;
    createMatrixCells();
  }

  function selectedTerm() {
    return elements.querySelect.value || CMS_TERMS[0];
  }

  function renderSelected() {
    const term = selectedTerm();
    const exact = exactCounts.get(term) || 0;
    const inspection = sketch.inspect(term);
    const overestimate = inspection.estimate - exact;

    elements.selectedValue.textContent = term;
    elements.selectedExact.textContent = formatInteger(exact);
    elements.selectedEstimate.textContent = formatInteger(inspection.estimate);
    elements.selectedOver.textContent = `+${formatInteger(overestimate)}`;
    elements.selectedOver.dataset.over = String(overestimate > 0);
    elements.selectedCells.textContent = inspection.cells
      .map(({ row, column }) => `r${row + 1}:c${formatInteger(column)}`)
      .join(' · ');
    elements.selectedCells.title = inspection.cells
      .map(({ row, column, value }) => `row ${row + 1}, column ${column}, count ${value}`)
      .join('\n');
  }

  function rankingRows() {
    return CMS_TERMS
      .map((term) => ({
        term,
        exact: exactCounts.get(term) || 0,
        estimate: sketch.estimate(term),
      }))
      .sort((a, b) => b.exact - a.exact || a.term.localeCompare(b.term))
      .slice(0, 9);
  }

  function renderRanking() {
    const fragment = document.createDocumentFragment();
    const selected = selectedTerm();
    for (const item of rankingRows()) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ranking-row';
      row.classList.toggle('is-selected', item.term === selected);
      row.dataset.term = item.term;
      row.setAttribute('aria-label', `${item.term}: exact ${item.exact}, estimated ${item.estimate}`);

      const term = document.createElement('span');
      term.className = 'ranking-row__term';
      term.textContent = item.term;
      const exact = document.createElement('span');
      exact.className = 'ranking-row__exact';
      exact.textContent = formatInteger(item.exact);
      const estimate = document.createElement('span');
      estimate.className = 'ranking-row__estimate';
      estimate.textContent = formatInteger(item.estimate);

      row.append(term, exact, estimate);
      fragment.append(row);
    }
    elements.ranking.replaceChildren(fragment);
  }

  function renderMatrix() {
    const counters = sketch.matrix;
    const groupSize = Math.ceil(sketch.width / displayColumns);
    const values = new Array(sketch.depth * displayColumns).fill(0);
    let maxValue = 0;

    for (let row = 0; row < sketch.depth; row += 1) {
      for (let displayColumn = 0; displayColumn < displayColumns; displayColumn += 1) {
        const start = displayColumn * groupSize;
        const end = Math.min(sketch.width, start + groupSize);
        let value = 0;
        for (let column = start; column < end; column += 1) {
          value = Math.max(value, counters[row * sketch.width + column]);
        }
        const offset = row * displayColumns + displayColumn;
        values[offset] = value;
        maxValue = Math.max(maxValue, value);
      }
    }

    const activeCells = new Set((latestInspection?.cells || []).map(({ row, column }) => (
      row * displayColumns + Math.min(displayColumns - 1, Math.floor(column / groupSize))
    )));
    const logMax = Math.log1p(maxValue || 1);

    matrixCells.forEach((cell, index) => {
      const value = values[index];
      const heat = value === 0 ? 0 : Math.log1p(value) / logMax;
      cell.style.setProperty('--heat', heat.toFixed(3));
      cell.classList.toggle('is-active', activeCells.has(index));
      const row = Math.floor(index / displayColumns);
      const displayColumn = index % displayColumns;
      const start = displayColumn * groupSize;
      const end = Math.min(sketch.width, start + groupSize) - 1;
      cell.title = `row ${row + 1}, columns ${start}–${Math.max(start, end)}, max ${value}`;
    });

    elements.matrix.setAttribute(
      'aria-label',
      `Count-Min Sketch matrix with ${sketch.depth} rows, ${formatInteger(sketch.width)} columns, and ${formatInteger(sketch.totalCount)} events.`,
    );
  }

  function renderMetrics() {
    let worstRatio = 0;
    for (const [term, exact] of exactCounts) {
      if (exact === 0) continue;
      worstRatio = Math.max(worstRatio, (sketch.estimate(term) - exact) / exact);
    }

    elements.total.textContent = formatInteger(sketch.totalCount);
    elements.width.textContent = formatInteger(sketch.width);
    elements.depth.textContent = String(sketch.depth);
    elements.worstOver.textContent = formatPercent(worstRatio, worstRatio < 0.001 ? 2 : 1);
    elements.matrixLabel.textContent = `${sketch.depth} × ${formatInteger(sketch.width)} counters`;
    elements.latest.textContent = latestTerm ? `${latestTerm} → ${formatInteger(latestInspection.estimate)}` : 'waiting for traffic';
  }

  function render() {
    renderSelected();
    renderRanking();
    renderMatrix();
    renderMetrics();
  }

  function observeTerm(term, shouldRender = true) {
    latestTerm = term;
    exactCounts.set(term, (exactCounts.get(term) || 0) + 1);
    latestInspection = sketch.add(term);
    if (shouldRender) render();
    return latestInspection;
  }

  function step(count = 1, shouldAnnounce = false) {
    const safeCount = clamp(Math.floor(Number(count) || 1), 1, 500);
    for (let index = 0; index < safeCount; index += 1) {
      observeTerm(stream(), index === safeCount - 1);
    }
    if (shouldAnnounce) announce(`${latestTerm} observed. Estimated count ${formatInteger(latestInspection.estimate)}.`);
  }

  function loop(timestamp) {
    if (!running) return;
    if (!previousFrameTime) previousFrameTime = timestamp;
    const elapsed = timestamp - previousFrameTime;
    if (elapsed >= 54) {
      const count = clamp(Math.round(elapsed / 10), 4, 12);
      step(count, false);
      previousFrameTime = timestamp;
    }
    animationFrame = requestAnimationFrame(loop);
  }

  function togglePlayback() {
    if (reducedMotion) {
      step(40, true);
      setPlaybackState(false);
      return;
    }
    setPlaybackState(!running);
    previousFrameTime = 0;
    if (running) animationFrame = requestAnimationFrame(loop);
  }

  function reset({ quiet = false, prefill = true } = {}) {
    setPlaybackState(false);
    for (const term of CMS_TERMS) exactCounts.set(term, 0);
    latestTerm = '';
    latestInspection = null;
    stream = createCmsStream(seed);
    rebuildSketch();
    if (prefill) step(180, false);
    else render();
    if (!quiet) announce('Count-Min Sketch traffic reset.');
  }

  function setMemory(bytes) {
    const next = clamp(Math.round(Number(bytes) || 4096), 256, 65536);
    if (next === currentMemory) return;
    currentMemory = next;
    rebuildSketch();
    render();
  }

  const { signal } = abortController;
  elements.playButton.addEventListener('click', togglePlayback, { signal });
  elements.stepButton.addEventListener('click', () => step(1, true), { signal });
  elements.resetButton.addEventListener('click', () => reset(), { signal });
  elements.querySelect.addEventListener('change', render, { signal });
  elements.ranking.addEventListener('click', (event) => {
    const row = event.target.closest('[data-term]');
    if (!row) return;
    elements.querySelect.value = row.dataset.term;
    render();
  }, { signal });

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && running) setPlaybackState(false);
    }, { threshold: 0.08 });
    observer.observe(root);
  }

  populateTerms();
  reset({ quiet: true, prefill: true });

  return {
    setMemory,
    reset,
    destroy() {
      setPlaybackState(false);
      observer?.disconnect();
      abortController.abort();
    },
  };
}
