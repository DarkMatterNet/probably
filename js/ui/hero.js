import { createRng } from '../core/random.js';
import { formatBytes, formatInteger, formatPercent } from '../core/format.js';

const EXACT_BYTES_PER_EVENT = 38;

export function createHero({ canvas, metrics, reducedMotion = false, seed = 20260815 }) {
  const context = canvas?.getContext?.('2d');
  const rng = createRng(seed);
  const particles = [];
  let memoryBytes = 4096;
  let eventCount = 248_000;
  let frameId = 0;
  let lastTime = 0;
  let width = 0;
  let height = 0;
  let running = false;
  let resizeObserver;

  function resize() {
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    draw(0);
  }

  function makeParticle(initial = false) {
    const upperLane = rng() > 0.48;
    return {
      x: initial ? rng() * width : -12,
      y: height * (upperLane ? 0.34 : 0.53) + (rng() - 0.5) * height * 0.19,
      speed: 32 + rng() * 78,
      radius: 0.55 + rng() * 1.45,
      alpha: 0.16 + rng() * 0.74,
      lane: upperLane ? 'lime' : 'violet',
      drift: (rng() - 0.5) * 6,
    };
  }

  function seedParticles() {
    particles.length = 0;
    const count = reducedMotion ? 45 : Math.min(180, Math.max(80, Math.round(width / 5.5)));
    for (let index = 0; index < count; index += 1) particles.push(makeParticle(true));
  }

  function updateMetrics() {
    const exactBytes = Math.max(memoryBytes * 1.4, eventCount * EXACT_BYTES_PER_EVENT);
    const saved = Math.max(0, 1 - memoryBytes / exactBytes);
    const error = Math.min(0.24, 0.018 * Math.sqrt(4096 / memoryBytes));

    if (metrics.events) metrics.events.textContent = `${formatInteger(eventCount)} events`;
    if (metrics.exact) metrics.exact.textContent = formatBytes(exactBytes);
    if (metrics.probabilistic) metrics.probabilistic.textContent = formatBytes(memoryBytes);
    if (metrics.saved) metrics.saved.textContent = formatPercent(saved, 1);
    if (metrics.error) metrics.error.textContent = formatPercent(error, 2);
  }

  function draw(deltaSeconds) {
    if (!context || !width || !height) return;
    context.clearRect(0, 0, width, height);

    const centerX = width * 0.54;
    const exactY = height * 0.36;
    const probableY = height * 0.54;

    const exactGradient = context.createLinearGradient(0, 0, width, 0);
    exactGradient.addColorStop(0, 'rgba(213,231,239,0)');
    exactGradient.addColorStop(0.28, 'rgba(213,231,239,0.18)');
    exactGradient.addColorStop(0.62, 'rgba(213,231,239,0.04)');
    exactGradient.addColorStop(1, 'rgba(213,231,239,0)');
    context.strokeStyle = exactGradient;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, exactY);
    context.bezierCurveTo(centerX * 0.72, exactY - 20, centerX * 0.88, exactY, width, exactY + 4);
    context.stroke();

    const probableGradient = context.createLinearGradient(0, 0, width, 0);
    probableGradient.addColorStop(0, 'rgba(173,113,255,0)');
    probableGradient.addColorStop(0.28, 'rgba(173,113,255,0.22)');
    probableGradient.addColorStop(0.7, 'rgba(185,243,74,0.08)');
    probableGradient.addColorStop(1, 'rgba(185,243,74,0)');
    context.strokeStyle = probableGradient;
    context.beginPath();
    context.moveTo(0, probableY);
    context.bezierCurveTo(centerX * 0.7, probableY + 18, centerX * 0.88, probableY, width, probableY - 6);
    context.stroke();

    if (!particles.length) seedParticles();

    for (const particle of particles) {
      if (!reducedMotion && deltaSeconds > 0) {
        particle.x += particle.speed * deltaSeconds;
        particle.y += particle.drift * deltaSeconds;
        if (particle.x > width + 15) Object.assign(particle, makeParticle(false));
      }

      const travel = Math.max(0, Math.min(1, particle.x / Math.max(width, 1)));
      const convergence = Math.sin(travel * Math.PI) * 0.34;
      const targetY = particle.lane === 'lime' ? exactY : probableY;
      const y = particle.y + (targetY - particle.y) * convergence;
      context.beginPath();
      context.fillStyle = particle.lane === 'lime'
        ? `rgba(185,243,74,${particle.alpha})`
        : `rgba(173,113,255,${particle.alpha})`;
      context.shadowColor = particle.lane === 'lime' ? 'rgba(185,243,74,.45)' : 'rgba(173,113,255,.42)';
      context.shadowBlur = 7;
      context.arc(particle.x, y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;
  }

  function tick(time) {
    if (!running) return;
    const deltaSeconds = Math.min(0.05, Math.max(0, (time - lastTime) / 1000 || 0));
    lastTime = time;
    eventCount += Math.round(deltaSeconds * 1680);
    draw(deltaSeconds);
    updateMetrics();
    frameId = requestAnimationFrame(tick);
  }

  function start() {
    if (running || !context) return;
    running = true;
    lastTime = performance.now();
    if (reducedMotion) {
      draw(0);
      updateMetrics();
      return;
    }
    frameId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
  }

  function setMemory(bytes) {
    memoryBytes = Math.max(256, Number(bytes) || 4096);
    updateMetrics();
  }

  function destroy() {
    stop();
    resizeObserver?.disconnect();
  }

  if (canvas && context) {
    resizeObserver = new ResizeObserver(() => {
      resize();
      seedParticles();
    });
    resizeObserver.observe(canvas);
    resize();
    seedParticles();
    updateMetrics();
  }

  return { start, stop, resize, setMemory, destroy };
}
