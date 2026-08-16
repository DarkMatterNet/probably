import test from 'node:test';
import assert from 'node:assert/strict';

import {
  browserLaunchArgs,
  browserLaunchCandidates,
  browserStartTimeout,
} from '../scripts/browser-qa-config.mjs';

test('browser QA gives hosted runners enough time to expose DevTools', () => {
  assert.equal(browserStartTimeout({}), 45_000);
  assert.equal(browserStartTimeout({ BROWSER_QA_START_TIMEOUT_MS: '60000' }), 60_000);
  assert.equal(browserStartTimeout({ BROWSER_QA_START_TIMEOUT_MS: '500' }), 45_000);
});

test('browser QA prefers an explicit path, then Google Chrome before Chromium wrappers', () => {
  const candidates = browserLaunchCandidates({ CHROMIUM_PATH: '/custom/chrome' });

  assert.equal(candidates[0], '/custom/chrome');
  assert.ok(candidates.indexOf('/usr/bin/google-chrome') < candidates.indexOf('/usr/bin/chromium'));
});

test('browser QA launch flags suppress first-run work and expose DevTools', () => {
  const args = browserLaunchArgs('/tmp/probably-profile');

  for (const flag of [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    '--user-data-dir=/tmp/probably-profile',
  ]) {
    assert.ok(args.includes(flag), flag);
  }
  assert.equal(args.at(-1), 'about:blank');
});
