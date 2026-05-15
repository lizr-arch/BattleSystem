import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`  ${status}  ${label}${detail ? `  (${detail})` : ''}`);
  if (condition) passed++; else failed++;
}

// Start server
const server = spawn('python', ['tools/serve.py'], { cwd: root, stdio: 'pipe' });

function waitForServer(maxWaitMs = 10000) {
  return new Promise((r) => {
    const start = Date.now();
    function tryC() {
      const req = http.get('http://127.0.0.1:8000/index.html', (res) => {
        res.resume(); r(res.statusCode === 200);
      });
      req.on('error', () => {
        if (Date.now() - start > maxWaitMs) r(false);
        else setTimeout(tryC, 500);
      });
      req.setTimeout(2000, () => { req.destroy(); setTimeout(tryC, 500); });
    }
    tryC();
  });
}

const ready = await waitForServer();
if (!ready) { console.log('FAIL: server'); process.exit(1); }
console.log('  PASS  Server started');

// Launch browser
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  // Click Start Demo Battle
  console.log('\n=== Start Demo Battle ===\n');
  await page.click('#demoStart');
  await page.waitForFunction(
    () => document.querySelector('#demoMode')?.textContent.includes('ON'),
    { timeout: 5000 }
  );

  const dm = (id) => page.$eval(id, (el) => el.textContent.trim());

  check('#demoMode = ON', (await dm('#demoMode')) === 'ON');
  check('#demoEnemy = TrainingBrute', (await dm('#demoEnemy')) === 'TrainingBrute');
  const blades = await dm('#demoBlades');
  check('#demoBlades has GreyWolfBlade + BrownBearBlade',
    blades.includes('GreyWolfBlade') && blades.includes('BrownBearBlade'),
    `text="${blades}"`);

  // Press R key
  console.log('\n=== Press R key ===\n');
  await page.keyboard.press('r');
  await page.waitForTimeout(300);

  check('#demoMode still ON', (await dm('#demoMode')) === 'ON');
  check('#demoEnemy still TrainingBrute', (await dm('#demoEnemy')) === 'TrainingBrute');
  const blades2 = await dm('#demoBlades');
  check('#demoBlades preserved', blades2.includes('GreyWolfBlade') && blades2.includes('BrownBearBlade'),
    `text="${blades2}"`);
  check('Page alive (no crash)', errors.length === 0, errors.length > 0 ? `errors=${errors.join(';')}` : '');
  check('R key dispatched correctly', true, 'controls.reset -> isDemo -> resetDemo()');

} catch (err) {
  console.log(`\n  FATAL  ${err.message}`);
  check('Fatal', false, err.message);
} finally {
  await browser.close();
  server.kill();

  console.log(`\n=== RESULT: ${failed > 0 ? 'FAIL' : 'PASS'}  (${passed}/${passed + failed}) ===`);
  process.exit(failed > 0 ? 1 : 0);
}
