// Dev helper: writes version.json whenever the game's source changes, so open games can offer a restart.
// Run next to live-server: node dev/version_watch.mjs
import { watch, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'version.json');
const write = () => writeFileSync(out, JSON.stringify({ v: Date.now() }));

write();
let timer = null;
const schedule = () => { clearTimeout(timer); timer = setTimeout(write, 300); };

watch(join(root, 'src'), { recursive: true }, schedule);
watch(join(root, 'index.html'), schedule);
console.log('Watching src/ and index.html for changes');
