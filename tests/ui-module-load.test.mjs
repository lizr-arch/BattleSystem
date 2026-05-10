import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', rootUrl);
const indexHtml = await fs.readFile(indexUrl, 'utf8');

const importMatch = indexHtml.match(/import\s+\{\s*startSandboxApp\s*\}\s+from\s+['"](.+?)['"]/);
assert.ok(importMatch, 'index.html should import startSandboxApp from a module path');

const modulePath = importMatch[1];
assert.ok(modulePath.endsWith('/src/ui/sandbox-app.js') || modulePath.endsWith('src/ui/sandbox-app.js'));

const normalized = modulePath.replace(/^\.\//, '');
const moduleUrl = new URL(normalized, rootUrl);
const mod = await import(moduleUrl.href);

assert.equal(typeof mod.startSandboxApp, 'function');

console.log('ui module load test passed');

