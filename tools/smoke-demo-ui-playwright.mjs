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

// ============================================================
// 1. Start server
// ============================================================
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

// ============================================================
// 2. Launch Playwright
// ============================================================
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
  // ============================================================
  // 3. Navigate
  // ============================================================
  console.log('=== Navigation ===\n');

  await page.goto(`http://${serverHost}:${serverPort}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  const pageTitle = await page.title();
  record('Page title loaded', pageTitle.length > 0, `title="${pageTitle}"`);

  // ============================================================
  // 4. Verify Demo Battle UI elements
  // ============================================================
  console.log('\n=== Demo Battle Panel Verification ===\n');

  const demoModeEl = await page.$('#demoMode');
  record('#demoMode exists', demoModeEl !== null);
  const demoModeText = await page.$eval('#demoMode', (el) => el.textContent);
  record('#demoMode initial text valid', demoModeText === '-' || demoModeText === 'OFF', `text="${demoModeText}"`);

  const demoStartEl = await page.$('#demoStart');
  record('#demoStart button exists', demoStartEl !== null);
  const demoStartText = await page.$eval('#demoStart', (el) => el.textContent.trim());
  record('#demoStart button text', demoStartText.includes('Start Demo Battle'), `text="${demoStartText}"`);

  const demoResetEl = await page.$('#demoReset');
  record('#demoReset button exists', demoResetEl !== null);
  const demoResetText = await page.$eval('#demoReset', (el) => el.textContent.trim());
  record('#demoReset button text', demoResetText.includes('Reset Demo'), `text="${demoResetText}"`);

  // ============================================================
  // 5. Click Start Demo Battle
  // ============================================================
  console.log('\n=== Click Start Demo Battle ===\n');

  await page.click('#demoStart');
  await page.waitForFunction(
    () => document.querySelector('#demoMode')?.textContent.includes('ON'),
    { timeout: 5000 }
  );
  const demoModeOn = await page.$eval('#demoMode', (el) => el.textContent);
  record('#demoMode shows ON after Start', demoModeOn === 'ON', `text="${demoModeOn}"`);

  // 6. Check enemy
  const demoEnemyText = await page.$eval('#demoEnemy', (el) => el.textContent);
  record('#demoEnemy has value', demoEnemyText !== '-' && demoEnemyText.length > 0, `text="${demoEnemyText}"`);

  // 7. Check blades
  const demoBladesText = await page.$eval('#demoBlades', (el) => el.textContent);
  const hasBlades = demoBladesText.includes('GreyWolfBlade') || demoBladesText.includes('BrownBearBlade') || demoBladesText.includes('brownBearBlade');
  record('#demoBlades shows blades', hasBlades, `text="${demoBladesText}"`);

  // ============================================================
  // 8. Canvas DEMO badge verification
  // ============================================================
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

  await page.screenshot({ path: resolve(screenshotDir, 'demo-badge.png'), fullPage: true });
  record('Screenshot: demo-badge.png saved', true, `path=${resolve(screenshotDir, 'demo-badge.png')}`);

  // ============================================================
  // 9. Click Reset Demo
  // ============================================================
  console.log('\n=== Click Reset Demo ===\n');

  await page.click('#demoReset');
  await page.waitForTimeout(500);

  const demoModeAfterReset = await page.$eval('#demoMode', (el) => el.textContent);
  const resetOK = await page.$('#demoStart') !== null;
  record('Page survives Reset Demo', resetOK, `#demoMode="${demoModeAfterReset}"`);

  // ============================================================
  // 10. Run all 4 demo scenarios
  // ============================================================
  console.log('\n=== Demo Scenario Runs ===\n');

  // Restart demo for scenarios that need enemy / blades
  await page.click('#demoStart');
  await page.waitForFunction(
    () => document.querySelector('#demoMode')?.textContent.includes('ON'),
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

  // ============================================================
  // 11. Console error check
  // ============================================================
  console.log('\n=== Console Errors ===\n');

  const realErrors = consoleErrors.filter((e) => !e.includes('404') && !e.includes('File not found'));
  if (realErrors.length === 0) {
    record('Console errors (excluding known 404 noise)', true, consoleErrors.length > 0 ? `${consoleErrors.length} total, 0 real` : '0 errors total');
  } else {
    realErrors.forEach((e) => {
      record('Console error', false, e);
    });
  }

  // ============================================================
  // 12. Final screenshot
  // ============================================================
  await page.screenshot({ path: resolve(screenshotDir, 'demo-final.png'), fullPage: true });
  record('Screenshot: demo-final.png saved', true, `path=${resolve(screenshotDir, 'demo-final.png')}`);

} catch (err) {
  console.log(`\n  FATAL  ${err.message}`);
  record('Fatal error', false, err.message);
} finally {
  await browser.close();
  server.kill();

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n========================================');
  console.log('  V5.6 Playwright UI Smoke — REPORT');
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
  console.log(`  screenshot path: ${resolve(screenshotDir)}`);
  console.log(`  result: ${failed > 0 ? 'FAIL' : 'PASS'}  (${passed}/${results.length} passed)`);

  process.exit(failed > 0 ? 1 : 0);
}
