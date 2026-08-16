import { formatBytes } from './core/format.js';

export const MEMORY_OPTIONS = Object.freeze([256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536]);
const VALID_LABS = new Set(['overview', 'bloom', 'hyperloglog', 'count-min', 'method']);
const DEFAULT_STATE = Object.freeze({ memoryBytes: 4096, lab: 'overview', seed: 20260815 });

function nearestMemory(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_STATE.memoryBytes;
  let best = MEMORY_OPTIONS[0];
  let distance = Math.abs(numeric - best);
  for (const option of MEMORY_OPTIONS.slice(1)) {
    const optionDistance = Math.abs(numeric - option);
    if (optionDistance < distance) {
      best = option;
      distance = optionDistance;
    }
  }
  return best;
}

export function parseUrlState(search = '') {
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  const labCandidate = params.get('lab') || DEFAULT_STATE.lab;
  const seedCandidate = Number.parseInt(params.get('seed') || '', 10);

  return {
    memoryBytes: nearestMemory(params.has('memory') ? params.get('memory') : DEFAULT_STATE.memoryBytes),
    lab: VALID_LABS.has(labCandidate) ? labCandidate : DEFAULT_STATE.lab,
    seed: Number.isSafeInteger(seedCandidate) && seedCandidate >= 0 ? seedCandidate : DEFAULT_STATE.seed,
  };
}

export function serializeUrlState(state) {
  const safe = {
    memoryBytes: nearestMemory(state?.memoryBytes),
    lab: VALID_LABS.has(state?.lab) ? state.lab : DEFAULT_STATE.lab,
    seed: Number.isSafeInteger(state?.seed) && state.seed >= 0 ? state.seed : DEFAULT_STATE.seed,
  };
  const params = new URLSearchParams();
  params.set('memory', String(safe.memoryBytes));
  params.set('lab', safe.lab);
  params.set('seed', String(safe.seed));
  return `?${params.toString()}`;
}

export function memoryIndexToBytes(index) {
  const safeIndex = Math.min(MEMORY_OPTIONS.length - 1, Math.max(0, Math.round(Number(index) || 0)));
  return MEMORY_OPTIONS[safeIndex];
}

export function memoryBytesToIndex(bytes) {
  return MEMORY_OPTIONS.indexOf(nearestMemory(bytes));
}

async function bootstrap() {
  const [
    { createHero },
    { createToast },
    { createBloomLab },
    { createHllLab },
    { createCmsLab },
  ] = await Promise.all([
    import('./ui/hero.js'),
    import('./ui/toast.js'),
    import('./ui/bloom-lab.js'),
    import('./ui/hll-lab.js'),
    import('./ui/cms-lab.js'),
  ]);

  const state = parseUrlState(window.location.search);
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toast = createToast(document.getElementById('toast-region'));
  const memoryInput = document.getElementById('memory-budget');
  const memoryOutput = document.getElementById('memory-budget-value');

  memoryInput.value = String(memoryBytesToIndex(state.memoryBytes));
  memoryOutput.value = formatBytes(state.memoryBytes);
  memoryOutput.textContent = formatBytes(state.memoryBytes);

  const hero = createHero({
    canvas: document.getElementById('hero-canvas'),
    metrics: {
      events: document.getElementById('hero-events'),
      exact: document.getElementById('hero-exact-memory'),
      probabilistic: document.getElementById('hero-prob-memory'),
      saved: document.getElementById('hero-memory-saved'),
      error: document.getElementById('hero-error'),
    },
    reducedMotion: reducedMotionQuery.matches,
    seed: state.seed,
  });

  const labs = [
    createBloomLab({ root: document.getElementById('bloom-root'), memoryBytes: state.memoryBytes, seed: state.seed, announce: toast }),
    createHllLab({ root: document.getElementById('hll-root'), memoryBytes: state.memoryBytes, seed: state.seed + 1, announce: toast, reducedMotion: reducedMotionQuery.matches }),
    createCmsLab({ root: document.getElementById('cms-root'), memoryBytes: state.memoryBytes, seed: state.seed + 2, announce: toast, reducedMotion: reducedMotionQuery.matches }),
  ];

  function updateUrl() {
    const query = serializeUrlState(state);
    const next = `${window.location.pathname}${query}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }

  function setActiveSection(section) {
    if (!VALID_LABS.has(section)) return;
    state.lab = section;
    document.querySelectorAll('[data-section-link]').forEach((link) => {
      link.classList.toggle('is-active', link.dataset.sectionLink === section);
    });
    updateUrl();
  }

  memoryInput.addEventListener('input', () => {
    state.memoryBytes = memoryIndexToBytes(memoryInput.value);
    const formatted = formatBytes(state.memoryBytes);
    memoryOutput.value = formatted;
    memoryOutput.textContent = formatted;
    hero.setMemory(state.memoryBytes);
    labs.forEach((lab) => lab.setMemory(state.memoryBytes));
    updateUrl();
  });

  document.getElementById('share-button').addEventListener('click', async () => {
    updateUrl();
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast('Experiment link copied.');
    } catch {
      try {
        await navigator.share({ title: document.title, url: shareUrl });
      } catch {
        window.prompt('Copy this experiment link:', shareUrl);
      }
    }
  });

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
    if (visible?.target?.dataset?.section) setActiveSection(visible.target.dataset.section);
  }, { rootMargin: '-25% 0px -55% 0px', threshold: [0.05, 0.2, 0.5] });

  document.querySelectorAll('.section-observed').forEach((section) => observer.observe(section));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hero.stop();
    else hero.start();
  });

  reducedMotionQuery.addEventListener?.('change', () => window.location.reload());
  hero.setMemory(state.memoryBytes);
  hero.start();
  setActiveSection(state.lab);

  if (state.lab !== 'overview') {
    window.requestAnimationFrame(() => document.querySelector(`[data-section="${state.lab}"]`)?.scrollIntoView({ behavior: 'auto' }));
  }

  window.addEventListener('beforeunload', () => {
    observer.disconnect();
    hero.destroy();
    labs.forEach((lab) => lab.destroy());
  }, { once: true });
}

if (typeof document !== 'undefined') {
  bootstrap().catch((error) => {
    console.error('Probably failed to start.', error);
    const region = document.getElementById('toast-region');
    if (region) {
      const message = document.createElement('div');
      message.className = 'toast';
      message.textContent = 'The experiment could not start. Refresh to try again.';
      region.append(message);
    }
  });
}
