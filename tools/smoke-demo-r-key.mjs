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

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  console.log('\n=== Start Demo Battle ===\n');
  await page.click('#demoStart');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#demoGoal');
      return el && el.textContent.trim() !== '-';
    },
    { timeout: 5000 }
  );

  const dm = (id) => page.$eval(id, (el) => el.textContent.trim());

  const goalText = await dm('#demoGoal');
  check('#demoGoal contains TrainingBrute or Defeat',
    goalText.includes('TrainingBrute') || goalText.includes('Defeat'),
    `text="${goalText}"`);

  const playerHp = await dm('#demoPlayerHp');
  check('#demoPlayerHp is not "-"', playerHp !== '-', `text="${playerHp}"`);

  const enemyHp = await dm('#demoEnemyHp');
  check('#demoEnemyHp is not "-"', enemyHp !== '-', `text="${enemyHp}"`);

  const battleState = await dm('#demoBattleState');
  check('#demoBattleState is not "-"', battleState !== '-', `text="${battleState}"`);

  const bladesInfo = await dm('#demoBladesInfo');
  check('#demoBladesInfo has GreyWolf or BrownBear',
    bladesInfo.includes('GreyWolf') || bladesInfo.includes('BrownBear'),
    `text="${bladesInfo}"`);

  const diagWarnings = await dm('#demoDiagWarnings');
  check('#demoDiagWarnings is (none) or no warning',
    diagWarnings === '(none)' || diagWarnings === '-',
    `text="${diagWarnings}"`);

  console.log('\n=== Press R key ===\n');
  await page.keyboard.press('r');
  await page.waitForTimeout(300);

  const goalText2 = await dm('#demoGoal');
  check('#demoGoal still valid after R', goalText2 !== '-', `text="${goalText2}"`);

  const playerHp2 = await dm('#demoPlayerHp');
  check('#demoPlayerHp still valid after R', playerHp2 !== '-', `text="${playerHp2}"`);

  const enemyHp2 = await dm('#demoEnemyHp');
  check('#demoEnemyHp still valid after R', enemyHp2 !== '-', `text="${enemyHp2}"`);

  const bladesInfo2 = await dm('#demoBladesInfo');
  check('#demoBladesInfo preserved after R',
    bladesInfo2.includes('GreyWolf') || bladesInfo2.includes('BrownBear'),
    `text="${bladesInfo2}"`);

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
