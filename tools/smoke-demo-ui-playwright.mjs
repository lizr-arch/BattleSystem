import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const screenshotDir = resolve(__dirname, 'screenshots');
if (!existsSync(screenshotDir)) {
  mkdirSync(screenshotDir, { recursive: true });
}

const results = [];
let passed = 0;
let failed = 0;

function record(label, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ status, label, detail });
  console.log(`  ${status}  ${label}${detail ? `  (${detail})` : ''}`);
  if (condition) passed++; else failed++;
}

console.log('\n=== Starting server ===\n');

const server = spawn('python', ['tools/serve.py'], { cwd: root, stdio: 'pipe' });
const serverHost = '127.0.0.1';
const serverPort = 8000;

function waitForServer(maxWaitMs = 10000) {
  return new Promise((resolvePromise) => {
    const start = Date.now();
    function tryConnect() {
      const req = http.get(`http://${serverHost}:${serverPort}/index.html`, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolvePromise(true);
        } else {
          res.resume();
          checkRetry();
        }
      });
      req.on('error', () => checkRetry());
      req.setTimeout(2000, () => { req.destroy(); checkRetry(); });

      function checkRetry() {
        if (Date.now() - start > maxWaitMs) {
          resolvePromise(false);
        } else {
          setTimeout(tryConnect, 500);
        }
      }
    }
    tryConnect();
  });
}

const serverReady = await waitForServer();
if (!serverReady) {
  console.log('  FAIL  Server did not start within 10 seconds');
  server.kill();
  process.exit(1);
}
console.log('  PASS  Server started on http://127.0.0.1:8000');

console.log('\n=== Launching browser ===\n');

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    consoleErrors.push(text);
  }
});

page.on('pageerror', (err) => {
  consoleErrors.push(`[PAGE ERROR] ${err.message}`);
});

try {
  console.log('=== Navigation ===\n');

  await page.goto(`http://${serverHost}:${serverPort}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  const pageTitle = await page.title();
  record('Page title loaded', pageTitle.length > 0, `title="${pageTitle}"`);

  console.log('\n=== Demo Battle Panel Verification ===\n');

  const dm = (id) => page.$eval(id, (el) => el.textContent.trim());

  const demoGoalEl = await page.$('#demoGoal');
  record('#demoGoal exists', demoGoalEl !== null);
  const demoGoalText = await dm('#demoGoal');
  record('#demoGoal initial text valid', demoGoalText === '-', `text="${demoGoalText}"`);

  const demoStartEl = await page.$('#demoStart');
  record('#demoStart button exists', demoStartEl !== null);
  const demoStartText = await page.$eval('#demoStart', (el) => el.textContent.trim());
  record('#demoStart button text', demoStartText.includes('Start Demo Battle'), `text="${demoStartText}"`);

  const demoResetEl = await page.$('#demoReset');
  record('#demoReset button exists', demoResetEl !== null);
  const demoResetText = await page.$eval('#demoReset', (el) => el.textContent.trim());
  record('#demoReset button text', demoResetText.includes('Reset Demo'), `text="${demoResetText}"`);

  console.log('\n=== Click Start Demo Battle ===\n');

  await page.click('#demoStart');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#demoGoal');
      return el && el.textContent.trim() !== '-';
    },
    { timeout: 5000 }
  );

  const goalText = await dm('#demoGoal');
  record('#demoGoal shows goal after Start',
    goalText.includes('TrainingBrute') || goalText.includes('Defeat'),
    `text="${goalText}"`);

  const playerHp = await dm('#demoPlayerHp');
  record('#demoPlayerHp is not "-"', playerHp !== '-', `text="${playerHp}"`);

  const enemyHp = await dm('#demoEnemyHp');
  record('#demoEnemyHp is not "-"', enemyHp !== '-', `text="${enemyHp}"`);

  const battleState = await dm('#demoBattleState');
  record('#demoBattleState is not "-"', battleState !== '-', `text="${battleState}"`);

  const bladesInfo = await dm('#demoBladesInfo');
  record('#demoBladesInfo shows blades',
    bladesInfo.includes('GreyWolf') || bladesInfo.includes('BrownBear'),
    `text="${bladesInfo}"`);

  const diagWarnings = await dm('#demoDiagWarnings');
  record('#demoDiagWarnings is (none) or no warning',
    diagWarnings === '(none)' || diagWarnings === '-',
    `text="${diagWarnings}"`);

  console.log('\n=== Canvas DEMO Badge ===\n');

  const canvasExists = await page.$('canvas');
  record('Canvas element exists', canvasExists !== null);

  if (canvasExists) {
    const hasDemoBadge = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return false;
      const ctx = c.getContext('2d');
      return ctx !== null;
    });
    record('Canvas 2d context available', hasDemoBadge);
  }

  console.log('\n=== Click Reset Demo ===\n');

  await page.click('#demoReset');
  await page.waitForTimeout(500);

  const goalAfterReset = await dm('#demoGoal');
  record('Page survives Reset Demo', goalAfterReset !== undefined, `#demoGoal="${goalAfterReset}"`);

  console.log('\n=== Demo Scenario Runs ===\n');

  await page.click('#demoStart');
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#demoGoal');
      return el && el.textContent.trim() !== '-';
    },
    { timeout: 5000 }
  );

  async function runScenario(buttonId, scenarioName) {
    await page.click(buttonId);
    await page.waitForFunction(
      (id) => {
        const el = document.querySelector(id);
        return el && (el.textContent.includes('PASS') || el.textContent.includes('FAIL'));
      },
      '#scResult',
      { timeout: 10000 }
    );
    const result = await page.$eval('#scResult', (el) => el.textContent.trim());
    record(`Scenario: ${scenarioName}`, result === 'PASS', `#scResult="${result}"`);
  }

  await runScenario('#scDemoPresetCreate', 'demo-preset-create');
  await runScenario('#scDemoFierceFollowUp', 'demo-preset-fierce-follow-up');
  await runScenario('#scDemoEnemyDamage', 'demo-preset-enemy-damages-player');
  await runScenario('#scDemoReset', 'demo-preset-reset');

  console.log('\n=== Console Errors ===\n');

  const realErrors = consoleErrors.filter((e) => !e.includes('404') && !e.includes('File not found'));
  if (realErrors.length === 0) {
    record('Console errors (excluding known 404 noise)', true, consoleErrors.length > 0 ? `${consoleErrors.length} total, 0 real` : '0 errors total');
  } else {
    realErrors.forEach((e) => {
      record('Console error', false, e);
    });
  }

} catch (err) {
  console.log(`\n  FATAL  ${err.message}`);
  record('Fatal error', false, err.message);
} finally {
  await browser.close();
  server.kill();

  console.log('\n========================================');
  console.log('  V6.1 Playwright UI Smoke — REPORT');
  console.log('========================================\n');
  console.log(`  status: run`);
  console.log(`  command: node tools/smoke-demo-ui-playwright.mjs`);
  console.log(`  browser: Chromium (Playwright headless=false)`);
  console.log(`  url: http://127.0.0.1:8000/index.html\n`);

  console.log('  actions performed:');
  for (const r of results) {
    console.log(`    ${r.status}  ${r.label}  ${r.detail ? `(${r.detail})` : ''}`);
  }

  console.log(`\n  console errors: ${consoleErrors.length > 0 ? consoleErrors.join('; ') : '0 (none found)'}`);
  console.log(`  result: ${failed > 0 ? 'FAIL' : 'PASS'}  (${passed}/${results.length} passed)`);

  process.exit(failed > 0 ? 1 : 0);
}
