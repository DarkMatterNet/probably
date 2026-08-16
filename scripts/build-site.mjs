import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, '_site');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ['index.html', 'styles.css', 'manifest.webmanifest']) {
  await cp(join(root, file), join(output, file));
}

for (const directory of ['assets', 'js', 'styles']) {
  await cp(join(root, directory), join(output, directory), { recursive: true });
}

await writeFile(join(output, '.nojekyll'), '');
console.log(`Static site assembled in ${output}`);
