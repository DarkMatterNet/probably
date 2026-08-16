import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import {
  browserLaunchCandidates,
  browserStartTimeout,
} from './browser-qa-config.mjs';

function resolveBrowser() {
  for (const candidate of browserLaunchCandidates()) {
    if (candidate.includes('/') && existsSync(candidate)) return candidate;
    if (!candidate.includes('/')) {
      const result = spawnSync('which', [candidate], { encoding: 'utf8' });
      if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
    }
  }
  return process.env.CHROMIUM_PATH;
}

const browser = resolveBrowser();
if (browser) process.env.CHROMIUM_PATH = browser;

const startupTimeout = browserStartTimeout();
const nativeSetTimeout = globalThis.setTimeout;

// browser-qa.mjs historically used a fixed 15-second DevTools startup window.
// Keep its focused QA implementation intact while giving slower hosted runners
// a configurable window. Other timers retain their original durations.
globalThis.setTimeout = (callback, delay, ...args) => nativeSetTimeout(
  callback,
  delay === 15_000 ? startupTimeout : delay,
  ...args,
);

console.log(`Browser QA launcher: ${browser || 'auto-detect'}`);
console.log(`Browser QA startup timeout: ${startupTimeout}ms`);

await import('./browser-qa.mjs');
