import { HyperLogLog } from '../core/hyperloglog.js';
import { clamp, formatInteger, formatPercent } from '../core/format.js';
import { createRng } from '../core/random.js';

const DISPLAY_REGISTERS = 128;
const MAX_PRECISION = 14;
const MIN_PRECISION = 4;

export function deriveHllPrecision(memoryBytes) {
  const safeBytes = Math.max(1, Math.floor(Number(memoryBytes) || 1));
  return clamp(Math.floor(Math.log2(safeBytes)), MIN_PRECISION, MAX_PRECISION);
}

export function createHllStream(seed = 1) {
  const rng = createRng(Number(seed) || 1);
  const history = [];
  let index = 0;

  return function next() {
    index += 1;
    if (history.length > 0 && index % 5 === 0) {
      return history[Math.floor(rng() * history.length)];
    }

    const left = Math.floor(rng() * 0xffffffff).toString(36);
    const right = Math.floor(rng() * 0xffff).toString(36);
    const value = `visitor-${left}${right}`;
    history.push(value);
    return value;
  };
}

export function createHllLab({
  root,
  memoryBytes = 4096,
  seed = 1,
  announce = () => {},
  reducedMotion = false,
} = {}) {
  if (!root) return { setMemory() {}, reset() {}, destroy() {} };

  const elements = {
    playButton: root.querySelector('#hll-play-button'),
    playLabel: root.querySelector('#hll-play-button span'),
    playIconPath: root.querySelector('#hll-play-button path'),
    stepButton: root.querySelector('#hll-step-button'),
    resetButton: root.querySelector('#hll-reset-button'),
    duplicateButton: root.querySelector('#hll-duplicate-button'),
    status: root.querySelector('#hll-stream-status'),
    latestValue: root.querySelector('#hll-latest-value'),
    hash: root.querySelector('#hll-hash'),
    register: root.querySelector('#hll-register'),
    rank: root.querySelector('#hll-rank'),
    changed: root.querySelector('#hll-changed'),
    exact: root.querySelector('#hll-exact'),
    estimate: root.querySelector('#hll-estimate'),
    error: root.querySelector('#hll-error'),
    standardError: root.querySelector('#hll-standard-error'),
    registerLabel: root.querySelector('#hll-register-label'),
    seen: root.querySelector('#hll-seen'),
    skyline: root.querySelector('#hll-registers'),
  };

  const abortController = new AbortController();
  const exactValues = new Set();
  const registerBars = [];
  let currentMemory = clamp(Math.round(Number(memoryBytes) || 4096), 256, 65536);
  let hll;
  let stream;
  let observations = 0;
  let latestValue = '';
  let latestInspection = null;
  let running = false;
  let animationFrame = 0;
  let previousFrameTime = 0;
  let observer;

  function createBars() {
    elements.skyline.replaceChildren();
    registerBars.length = 0;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < DISPLAY_REGISTERS; index += 1) {
      const bar = document.createElement('span');
      bar.className = 'register-bar';
      bar.style.height = '2%';
      bar.setAttribute('aria-hidden', 'true');
      fragment.append(bar);
      registerBars.push(bar);
    }
    elements.skyline.append(fragment);
  }

  function setPlaybackState(nextRunning) {
    running = Boolean(nextRunning);
    elements.status.textContent = running ? 'Live' : 'Paused';
    elements.status.classList.toggle('is-live', running);
    elements.playLabel.textContent = running ? 'Pause' : 'Play';
    elements.playButton.setAttribute('aria-label', running ? 'Pause stream' : 'Play stream');
    elements.playButton.setAttribute('aria-pressed', String(running));
    elements.playIconPath.setAttribute('d', running ? 'M8 5h3v14H8V5Zm5 0h3v14h-3V5Z' : 'm8 5 11 7-11 7V5Z');
    if (!running && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }

  function rebuildEstimator() {
    hll = new HyperLogLog({ precision: deriveHllPrecision(currentMemory), seed: BigInt(seed) });
    for (const value of exactValues) hll.add(value);
    if (latestValue) latestInspection = hll.inspect(latestValue);
  }

  function renderInspector() {
    if (!latestInspection || !latestValue) {
      elements.latestValue.textContent = 'waiting…';
      elements.hash.textContent = '—';
      elements.register.textContent = '—';
      elements.rank.textContent = '—';
      elements.changed.textContent = '—';
      return;
    }

    elements.latestValue.textContent = latestValue;
    elements.latestValue.title = latestValue;
    elements.hash.textContent = `0x${latestInspection.hashHex}`;
    elements.hash.title = `0x${latestInspection.hashHex}`;
    elements.register.textContent = `#${formatInteger(latestInspection.index)}`;
    elements.rank.textContent = String(latestInspection.rank);
    elements.changed.textContent = latestInspection.changed ? 'yes' : 'no';
    elements.changed.dataset.changed = String(latestInspection.changed);
  }

  function renderMetrics() {
    const exact = exactValues.size;
    const estimate = hll.estimate();
    const relativeError = exact === 0 ? 0 : Math.abs(estimate - exact) / exact;

    elements.exact.textContent = formatInteger(exact);
    elements.estimate.textContent = formatInteger(estimate);
    elements.error.textContent = formatPercent(relativeError, relativeError < 0.001 ? 2 : 1);
    elements.standardError.textContent = formatPercent(hll.standardError, 1);
    elements.registerLabel.textContent = `${formatInteger(hll.registerCount)} registers`;
    elements.seen.textContent = `${formatInteger(observations)} observation${observations === 1 ? '' : 's'}`;
  }

  function renderSkyline() {
    const registers = hll.registers;
    const groupSize = Math.ceil(registers.length / DISPLAY_REGISTERS);
    const activeGroup = latestInspection ? Math.floor(latestInspection.index / groupSize) : -1;

    for (let displayIndex = 0; displayIndex < DISPLAY_REGISTERS; displayIndex += 1) {
      const start = displayIndex * groupSize;
      const end = Math.min(registers.length, start + groupSize);
      let value = 0;
      for (let registerIndex = start; registerIndex < end; registerIndex += 1) {
        if (registers[registerIndex] > value) value = registers[registerIndex];
      }

      const height = value === 0 ? 2 : Math.min(100, 8 + (value / 18) * 92);
      const bar = registerBars[displayIndex];
      bar.style.height = `${height}%`;
      bar.classList.toggle('is-active', displayIndex === activeGroup);
      bar.title = `Registers ${formatInteger(start)}–${formatInteger(Math.max(start, end - 1))}: rank ${value}`;
    }

    elements.skyline.setAttribute(
      'aria-label',
      `HyperLogLog skyline with ${formatInteger(hll.registerCount)} registers and an estimate of ${formatInteger(hll.estimate())} unique values.`,
    );
  }

  function render() {
    renderInspector();
    renderMetrics();
    renderSkyline();
  }

  function observeValue(value, shouldRender = true) {
    latestValue = String(value);
    latestInspection = hll.add(latestValue);
    exactValues.add(latestValue);
    observations += 1;
    if (shouldRender) render();
    return latestInspection;
  }

  function step(count = 1, shouldAnnounce = false) {
    const safeCount = clamp(Math.floor(Number(count) || 1), 1, 500);
    for (let index = 0; index < safeCount; index += 1) {
      observeValue(stream(), index === safeCount - 1);
    }
    if (shouldAnnounce) announce(`Observed ${latestValue}. Estimated ${formatInteger(hll.estimate())} unique visitors.`);
  }

  function sendDuplicate() {
    if (!latestValue) step(1, false);
    latestInspection = hll.add(latestValue);
    observations += 1;
    render();
    announce(`${latestValue} repeated. The exact unique count stayed at ${formatInteger(exactValues.size)}.`);
  }

  function loop(timestamp) {
    if (!running) return;
    if (!previousFrameTime) previousFrameTime = timestamp;
    const elapsed = timestamp - previousFrameTime;
    if (elapsed >= 48) {
      const count = clamp(Math.round(elapsed / 12), 3, 10);
      step(count, false);
      previousFrameTime = timestamp;
    }
    animationFrame = requestAnimationFrame(loop);
  }

  function togglePlayback() {
    if (reducedMotion) {
      step(30, true);
      setPlaybackState(false);
      return;
    }

    setPlaybackState(!running);
    previousFrameTime = 0;
    if (running) animationFrame = requestAnimationFrame(loop);
  }

  function reset({ quiet = false, prefill = true } = {}) {
    setPlaybackState(false);
    exactValues.clear();
    observations = 0;
    latestValue = '';
    latestInspection = null;
    stream = createHllStream(seed);
    rebuildEstimator();
    if (prefill) step(96, false);
    else render();
    if (!quiet) announce('HyperLogLog stream reset.');
  }

  function setMemory(bytes) {
    const next = clamp(Math.round(Number(bytes) || 4096), 256, 65536);
    if (next === currentMemory) return;
    currentMemory = next;
    rebuildEstimator();
    render();
  }

  const { signal } = abortController;
  elements.playButton.addEventListener('click', togglePlayback, { signal });
  elements.stepButton.addEventListener('click', () => step(1, true), { signal });
  elements.resetButton.addEventListener('click', () => reset(), { signal });
  elements.duplicateButton.addEventListener('click', sendDuplicate, { signal });

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && running) setPlaybackState(false);
    }, { threshold: 0.08 });
    observer.observe(root);
  }

  createBars();
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
