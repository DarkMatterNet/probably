const DEFAULT_BROWSER_START_TIMEOUT_MS = 45_000;

export function browserStartTimeout(env = process.env) {
  const requested = Number.parseInt(env.BROWSER_QA_START_TIMEOUT_MS || '', 10);
  if (Number.isSafeInteger(requested) && requested >= 5_000 && requested <= 120_000) {
    return requested;
  }
  return DEFAULT_BROWSER_START_TIMEOUT_MS;
}

export function browserLaunchCandidates(env = process.env) {
  return [
    env.CHROMIUM_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
}

export function browserLaunchArgs(profileDir) {
  return [
    '--headless=new',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-sync',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ];
}
