import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const scanDirs = [
  'src/core',
  'src/data',
  'src/ui',
  'src/dev',
  'tests',
];

const requiredDocs = [
  'docs/system-map.md',
  'docs/mechanics-map.md',
  'docs/event-catalog.md',
  'docs/test-coverage-map.md',
  'docs/v3-readiness-review.md',
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRec(dirAbs) {
  const out = [];
  const queue = [dirAbs];
  while (queue.length) {
    const current = queue.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(current, ent.name);
      if (ent.isDirectory()) {
        queue.push(abs);
      } else if (ent.isFile()) {
        out.push(abs);
      }
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function rel(p) {
  return path.relative(rootDir, p).replaceAll('\\', '/');
}

function scanBannedStrings(text) {
  const hits = [];
  const patterns = [
    { word: 'window', re: /\bwindow\b/i },
    { word: 'document', re: /\bdocument\b/i },
    { word: 'canvas', re: /\bcanvas\b/i },
  ];
  for (const p of patterns) {
    if (p.re.test(text)) hits.push(p.word);
  }
  return hits;
}

function printSection(title) {
  console.log('');
  console.log(`== ${title} ==`);
}

let ok = true;

printSection('Project Map');
console.log(`root: ${rootDir}`);

for (const dir of scanDirs) {
  const abs = path.join(rootDir, dir);
  const dirOk = await exists(abs);
  if (!dirOk) {
    ok = false;
    console.log(`${dir}: MISSING`);
    continue;
  }

  const files = await listFilesRec(abs);
  console.log(`${dir}: ${files.length} files`);
  for (const f of files) {
    console.log(`- ${rel(f)}`);
  }
}

printSection('Core Dependency Guard');
const coreDir = path.join(rootDir, 'src/core');
const coreFiles = (await exists(coreDir)) ? await listFilesRec(coreDir) : [];
const bannedFindings = [];
for (const f of coreFiles) {
  if (!f.endsWith('.js') && !f.endsWith('.mjs')) continue;
  const text = await fs.readFile(f, 'utf8');
  const hits = scanBannedStrings(text);
  if (hits.length > 0) {
    bannedFindings.push({ file: rel(f), hits });
  }
}

if (bannedFindings.length === 0) {
  console.log('src/core: OK (no window/document/canvas substring found)');
} else {
  ok = false;
  console.log('src/core: FAIL (banned substrings found)');
  for (const x of bannedFindings) {
    console.log(`- ${x.file}: ${x.hits.join(', ')}`);
  }
}

printSection('Tests Check');
const testsDir = path.join(rootDir, 'tests');
if (await exists(testsDir)) {
  const files = (await listFilesRec(testsDir)).filter((f) => f.endsWith('.mjs'));
  console.log(`tests/*.mjs: ${files.length}`);
  for (const f of files) console.log(`- ${rel(f)}`);
} else {
  ok = false;
  console.log('tests: MISSING');
}

printSection('Docs Check');
for (const p of requiredDocs) {
  const abs = path.join(rootDir, p);
  const present = await exists(abs);
  console.log(`${p}: ${present ? 'OK' : 'MISSING'}`);
  if (!present) ok = false;
}

printSection('Result');
console.log(ok ? 'PASS' : 'FAIL');
if (!ok) process.exitCode = 1;
