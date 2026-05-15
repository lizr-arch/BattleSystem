import { readFileSync } from 'node:fs';
import { get } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const results = [];
let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    results.push({ status: 'PASS', label, detail });
    passed++;
  } else {
    results.push({ status: 'FAIL', label, detail });
    failed++;
  }
}

// ============ Layer 1: Static DOM Verification ============

console.log('=== LAYER 1: Static DOM Verification ===\n');

// --- index.html ---
const html = readFileSync(resolve(root, 'index.html'), 'utf-8');

check('index.html: #demoMode element exists', html.includes('id="demoMode"'));
check('index.html: #demoEnemy element exists', html.includes('id="demoEnemy"'));
check('index.html: #demoBlades element exists', html.includes('id="demoBlades"'));
check('index.html: #demoStart button exists', html.includes('id="demoStart"'));
check('index.html: #demoReset button exists', html.includes('id="demoReset"'));
check('index.html: #scDemoPresetCreate button exists', html.includes('id="scDemoPresetCreate"'));
check('index.html: #scDemoFierceFollowUp button exists', html.includes('id="scDemoFierceFollowUp"'));
check('index.html: #scDemoEnemyDamage button exists', html.includes('id="scDemoEnemyDamage"'));
check('index.html: #scDemoReset button exists', html.includes('id="scDemoReset"'));
check('index.html: #scResult element exists', html.includes('id="scResult"'));
check('index.html: <h2>Demo Battle</h2> heading exists', html.includes('<h2>Demo Battle</h2>'));

// --- sandbox-app.js ---
const sandboxApp = readFileSync(resolve(root, 'src/ui/sandbox-app.js'), 'utf-8');

check('sandbox-app.js: imports createDemoBattlePreset', sandboxApp.includes('createDemoBattlePreset'));
check('sandbox-app.js: imports resetDemoPreset', sandboxApp.includes('resetDemoPreset'));
check('sandbox-app.js: loadDemoPreset() method exists', sandboxApp.includes('loadDemoPreset()'));
check('sandbox-app.js: this.isDemo = true', sandboxApp.includes('this.isDemo = true'));
check('sandbox-app.js: resetDemo() method exists', sandboxApp.includes('resetDemo()'));
check('sandbox-app.js: resetDemoPreset called with actor', sandboxApp.includes('resetDemoPreset(this.actor)'));

// --- debug-panel.js ---
const debugPanel = readFileSync(resolve(root, 'src/ui/debug-panel.js'), 'utf-8');

check('debug-panel.js: scDemoPresetCreate ref', debugPanel.includes("'scDemoPresetCreate'"));
check('debug-panel.js: scDemoFierceFollowUp ref', debugPanel.includes("'scDemoFierceFollowUp'"));
check('debug-panel.js: scDemoEnemyDamage ref', debugPanel.includes("'scDemoEnemyDamage'"));
check('debug-panel.js: scDemoReset ref', debugPanel.includes("'scDemoReset'"));
check('debug-panel.js: demoMode ref', debugPanel.includes("'demoMode'"));
check('debug-panel.js: demoEnemy ref', debugPanel.includes("'demoEnemy'"));
check('debug-panel.js: demoBlades ref', debugPanel.includes("'demoBlades'"));
check('debug-panel.js: demoStart ref', debugPanel.includes("'demoStart'"));
check('debug-panel.js: demoReset ref', debugPanel.includes("'demoReset'"));
check('debug-panel.js: renderDemoPanel() method', debugPanel.includes('renderDemoPanel(s)'));
check('debug-panel.js: scDemoPresetCreate click listener', debugPanel.includes("scDemoPresetCreate.addEventListener('click'"));
check('debug-panel.js: scDemoFierceFollowUp click listener', debugPanel.includes("scDemoFierceFollowUp.addEventListener('click'"));
check('debug-panel.js: scDemoEnemyDamage click listener', debugPanel.includes("scDemoEnemyDamage.addEventListener('click'"));
check('debug-panel.js: scDemoReset click listener', debugPanel.includes("scDemoReset.addEventListener('click'"));
check('debug-panel.js: demoStart click listener', debugPanel.includes("demoStart.addEventListener('click'"));
check('debug-panel.js: demoReset click listener', debugPanel.includes("demoReset.addEventListener('click'"));

// --- canvas-renderer.js ---
const canvasRenderer = readFileSync(resolve(root, 'src/ui/canvas-renderer.js'), 'utf-8');

check('canvas-renderer.js: DEMO badge drawn', canvasRenderer.includes("fillText('DEMO'"));

// ============ Layer 2: HTTP Reachability ============

console.log('\n=== LAYER 2: HTTP Reachability ===\n');

const serverHost = '127.0.0.1';
const serverPort = 8000;

function httpCheck(label) {
  return new Promise((resolveCheck) => {
    const req = get(`http://${serverHost}:${serverPort}/index.html`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const statusOK = res.statusCode === 200;
        const ct = res.headers['content-type'] || '';
        const ctOK = ct.includes('text/html');
        const hasTitle = body.includes('<title>');
        const hasDemoMode = body.includes('id="demoMode"');
        const hasScResult = body.includes('id="scResult"');

        check(label + ': HTTP 200', statusOK, `status=${res.statusCode}`);
        check(label + ': Content-Type text/html', ctOK, `content-type=${ct}`);
        check(label + ': <title> present', hasTitle);
        check(label + ': #demoMode in response body', hasDemoMode);
        check(label + ': #scResult in response body', hasScResult);

        resolveCheck();
      });
    });
    req.on('error', (err) => {
      check(label + ': HTTP reachable', false, `error=${err.message}`);
      resolveCheck();
    });
    req.setTimeout(3000, () => {
      check(label + ': HTTP reachable', false, 'timeout after 3s');
      req.destroy();
      resolveCheck();
    });
  });
}

await httpCheck('HTTP GET /index.html');

// ============ Summary ============

console.log('\n=== SUMMARY ===\n');

for (const r of results) {
  console.log(`  ${r.status}  ${r.label}${r.detail ? `  (${r.detail})` : ''}`);
}

console.log(`\n  Total: ${results.length}  Passed: ${passed}  Failed: ${failed}`);

if (failed > 0) {
  console.log('\n  RESULT: FAIL');
  process.exit(1);
} else {
  console.log('\n  RESULT: PASS');
  process.exit(0);
}
