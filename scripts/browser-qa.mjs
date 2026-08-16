import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(projectRoot, '.qa');
const moduleCache = new Map();

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes('/') && existsSync(candidate)) return candidate;
    if (!candidate.includes('/')) {
      const result = spawnSync('which', [candidate], { encoding: 'utf8' });
      if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
    }
  }
  throw new Error('Chromium was not found. Set CHROMIUM_PATH to run browser QA.');
}

async function moduleDataUrl(path) {
  const absolutePath = resolve(path);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath);
  moduleCache.set(absolutePath, '');

  let source = await readFile(absolutePath, 'utf8');
  const importPattern = /(?<quote>['"])(?<specifier>\.{1,2}\/[^'"]+\.js)\k<quote>/g;
  const matches = [...source.matchAll(importPattern)];

  for (const match of matches) {
    const target = resolve(dirname(absolutePath), match.groups.specifier);
    const replacement = `${match.groups.quote}${await moduleDataUrl(target)}${match.groups.quote}`;
    source = source.replace(match[0], replacement);
  }

  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  moduleCache.set(absolutePath, url);
  return url;
}

async function buildDocument() {
  let html = await readFile(join(projectRoot, 'index.html'), 'utf8');
  const stylesheet = await readFile(join(projectRoot, 'styles.css'), 'utf8');
  const imports = [...stylesheet.matchAll(/@import\s+url\([\"']?([^\"')]+)[\"']?\);/g)];
  const css = imports.length
    ? (await Promise.all(imports.map((match) => readFile(join(projectRoot, match[1]), 'utf8')))).join('\n')
    : stylesheet;
  const appUrl = await moduleDataUrl(join(projectRoot, 'js/app.js'));

  html = html
    .replace('<link rel="stylesheet" href="./styles.css">', `<style>${css}</style>`)
    .replace('<link rel="icon" href="./assets/favicon.svg" type="image/svg+xml">', '')
    .replace('<link rel="manifest" href="./manifest.webmanifest">', '')
    .replace(
      '<script type="module" src="./js/app.js"></script>',
      `<script>history.replaceState = () => {};</script><script type="module" src="${appUrl}"></script>`,
    );
  return html;
}

function waitForDebuggerUrl(processHandle, timeoutMs = 15_000) {
  return new Promise((resolvePromise, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error(`Chromium did not expose DevTools within ${timeoutMs}ms.\n${buffer}`)), timeoutMs);

    processHandle.stderr.setEncoding('utf8');
    processHandle.stderr.on('data', (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolvePromise(match[1]);
      }
    });
    processHandle.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Chromium exited before DevTools was ready (code ${code}).\n${buffer}`));
    });
  });
}

async function findPageTarget(browserWebSocketUrl) {
  const match = browserWebSocketUrl.match(/^ws:\/\/([^/]+)\//);
  if (!match) throw new Error(`Unexpected DevTools URL: ${browserWebSocketUrl}`);
  const endpoint = `http://${match[1]}/json/list`;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // DevTools can take a moment to expose the first page target.
    }
    await delay(75);
  }
  throw new Error('No page target became available in Chromium.');
}

function createCdpClient(url, onEvent = () => {}) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let commandId = 0;

  const ready = new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', () => reject(new Error('Could not connect to the Chromium page target.')), { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(`${message.error.message} (${message.error.code})`));
      else request.resolve(message.result ?? {});
      return;
    }
    if (message.method) onEvent(message.method, message.params ?? {});
  });

  async function send(method, params = {}) {
    await ready;
    commandId += 1;
    const id = commandId;
    const response = new Promise((resolvePromise, reject) => pending.set(id, { resolve: resolvePromise, reject }));
    socket.send(JSON.stringify({ id, method, params }));
    return response;
  }

  return {
    ready,
    send,
    close() {
      socket.close();
    },
  };
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function run() {
  const chromiumPath = findChromium();
  const profileDir = await mkdtemp(join(tmpdir(), 'probably-chromium-'));
  await mkdir(outputDir, { recursive: true });

  const chromium = spawn(chromiumPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let client;
  const browserErrors = [];
  try {
    const browserUrl = await waitForDebuggerUrl(chromium);
    const pageUrl = await findPageTarget(browserUrl);
    client = createCdpClient(pageUrl, (method, params) => {
      if (method === 'Runtime.exceptionThrown') {
        browserErrors.push(params.exceptionDetails?.text || 'Uncaught browser exception');
      }
      if (method === 'Log.entryAdded' && params.entry?.level === 'error') {
        browserErrors.push(params.entry.text);
      }
    });

    await client.ready;
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
    ]);

    const { frameTree } = await client.send('Page.getFrameTree');
    await client.send('Page.setDocumentContent', {
      frameId: frameTree.frame.id,
      html: await buildDocument(),
    });

    async function evaluate(expression) {
      const response = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
      }
      return response.result?.value;
    }

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await evaluate("document.querySelector('#cms-total')?.textContent !== '0'");
      if (ready) break;
      if (attempt === 119) throw new Error('The application did not finish bootstrapping.');
      await delay(50);
    }

    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };

    const title = await evaluate('document.title');
    const heading = await evaluate("document.querySelector('h1').innerText");
    assert(title.includes('Probably'), 'Document title is missing the product name.');
    assert(heading.includes('Be probably right.'), 'Hero heading did not render.');

    const beforeBloom = await evaluate("Number(document.querySelector('#bloom-elements').textContent.replaceAll(',', ''))");
    await evaluate("document.querySelector('#bloom-sample-button').click()");
    const afterBloom = await evaluate("Number(document.querySelector('#bloom-elements').textContent.replaceAll(',', ''))");
    assert(afterBloom === beforeBloom + 25, 'Bloom sample insertion did not update its exact count.');

    const duplicateResult = await evaluate(`(() => {
      const before = document.querySelector('#hll-exact').textContent;
      document.querySelector('#hll-duplicate-button').click();
      return {
        before,
        after: document.querySelector('#hll-exact').textContent,
        changed: document.querySelector('#hll-changed').textContent,
      };
    })()`);
    assert(duplicateResult.before === duplicateResult.after, 'HLL duplicate changed exact cardinality.');
    assert(duplicateResult.changed === 'no', 'HLL duplicate changed a register.');

    const cmsResult = await evaluate(`(() => {
      const before = Number(document.querySelector('#cms-total').textContent.replaceAll(',', ''));
      document.querySelector('#cms-step-button').click();
      const after = Number(document.querySelector('#cms-total').textContent.replaceAll(',', ''));
      return { before, after };
    })()`);
    assert(cmsResult.after === cmsResult.before + 1, 'Count-Min step did not increment the stream.');

    await evaluate(`(() => {
      const input = document.querySelector('#memory-budget');
      input.value = '0';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    const memoryState = await evaluate(`({
      label: document.querySelector('#memory-budget-value').textContent,
      bloom: document.querySelector('#bloom-bit-label').textContent,
      hll: document.querySelector('#hll-register-label').textContent,
      cms: document.querySelector('#cms-width').textContent,
    })`);
    assert(memoryState.label === '256 B', 'Shared memory label did not update.');
    assert(memoryState.bloom === '2,048 bits', 'Bloom memory did not update.');
    assert(memoryState.hll === '256 registers', 'HLL memory did not update.');
    assert(memoryState.cms === '16', 'Count-Min memory did not update.');

    await evaluate(`(() => {
      const input = document.querySelector('#memory-budget');
      input.value = '4';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#toast-region').replaceChildren();
    })()`);

    async function screenshot(name, width, height) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width <= 640,
      });
      await evaluate('window.scrollTo(0, 0)');
      await delay(250);
      const overflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
      assert(overflow <= 1, `${name} viewport has ${overflow}px horizontal overflow.`);
      const { data } = await client.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await writeFile(join(outputDir, name), Buffer.from(data, 'base64'));
    }

    await screenshot('browser-desktop.png', 1440, 1000);
    await screenshot('browser-mobile.png', 390, 844);

    assert(browserErrors.length === 0, `Browser errors detected:\n${browserErrors.join('\n')}`);
    console.log('Probably browser QA passed.');
    console.log(`Desktop screenshot: ${join(outputDir, 'browser-desktop.png')}`);
    console.log(`Mobile screenshot: ${join(outputDir, 'browser-mobile.png')}`);
  } finally {
    client?.close();
    chromium.kill('SIGTERM');
    await Promise.race([
      chromium.exitCode == null
        ? new Promise((resolvePromise) => chromium.once('exit', resolvePromise))
        : Promise.resolve(),
      delay(1_500),
    ]);
    if (chromium.exitCode == null) {
      chromium.kill('SIGKILL');
      await new Promise((resolvePromise) => chromium.once('exit', resolvePromise));
    }
    await rm(profileDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
