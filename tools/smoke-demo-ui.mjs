import { readFileSync } from 'node:fs';
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

console.log('=== LAYER 1: Static DOM Verification ===\n');

const html = readFileSync(resolve(root, 'index.html'), 'utf-8');

check('index.html: #demoGoal element exists', html.includes('id="demoGoal"'));
check('index.html: #demoPlayerHp element exists', html.includes('id="demoPlayerHp"'));
check('index.html: #demoEnemyHp element exists', html.includes('id="demoEnemyHp"'));
check('index.html: #demoBattleState element exists', html.includes('id="demoBattleState"'));
check('index.html: #demoBladesInfo element exists', html.includes('id="demoBladesInfo"'));
check('index.html: #demoDiagWarnings element exists', html.includes('id="demoDiagWarnings"'));
check('index.html: #demoStart button exists', html.includes('id="demoStart"'));
check('index.html: #demoReset button exists', html.includes('id="demoReset"'));
check('index.html: #demoLastPayoff element exists', html.includes('id="demoLastPayoff"'));
check('index.html: #demoHint element exists', html.includes('id="demoHint"'));
check('index.html: #scDemoPresetCreate button exists', html.includes('id="scDemoPresetCreate"'));
check('index.html: #scDemoFierceFollowUp button exists', html.includes('id="scDemoFierceFollowUp"'));
check('index.html: #scDemoEnemyDamage button exists', html.includes('id="scDemoEnemyDamage"'));
check('index.html: #scDemoReset button exists', html.includes('id="scDemoReset"'));
check('index.html: #scResult element exists', html.includes('id="scResult"'));
check('index.html: <h2>Player HUD</h2> heading exists', html.includes('<h2>Player HUD</h2>'));
check('index.html: <h2>Developer Diagnostics</h2> heading exists', html.includes('<h2>Developer Diagnostics</h2>'));

const sandboxApp = readFileSync(resolve(root, 'src/ui/sandbox-app.js'), 'utf-8');

check('sandbox-app.js: imports createDemoBattlePreset', sandboxApp.includes('createDemoBattlePreset'));
check('sandbox-app.js: imports resetDemoPreset', sandboxApp.includes('resetDemoPreset'));
check('sandbox-app.js: loadDemoPreset() method exists', sandboxApp.includes('loadDemoPreset()'));
check('sandbox-app.js: this.isDemo = true', sandboxApp.includes('this.isDemo = true'));
check('sandbox-app.js: resetDemo() method exists', sandboxApp.includes('resetDemo()'));
check('sandbox-app.js: resetDemoPreset called with actor', sandboxApp.includes('resetDemoPreset(this.actor)'));

const debugPanel = readFileSync(resolve(root, 'src/ui/debug-panel.js'), 'utf-8');

check('debug-panel.js: scDemoPresetCreate ref', debugPanel.includes("'scDemoPresetCreate'"));
check('debug-panel.js: scDemoFierceFollowUp ref', debugPanel.includes("'scDemoFierceFollowUp'"));
check('debug-panel.js: scDemoEnemyDamage ref', debugPanel.includes("'scDemoEnemyDamage'"));
check('debug-panel.js: scDemoReset ref', debugPanel.includes("'scDemoReset'"));
check('debug-panel.js: demoGoal ref', debugPanel.includes("'demoGoal'"));
check('debug-panel.js: demoPlayerHp ref', debugPanel.includes("'demoPlayerHp'"));
check('debug-panel.js: demoEnemyHp ref', debugPanel.includes("'demoEnemyHp'"));
check('debug-panel.js: demoBattleState ref', debugPanel.includes("'demoBattleState'"));
check('debug-panel.js: demoBladesInfo ref', debugPanel.includes("'demoBladesInfo'"));
check('debug-panel.js: demoDiagWarnings ref', debugPanel.includes("'demoDiagWarnings'"));
check('debug-panel.js: demoStart ref', debugPanel.includes("'demoStart'"));
check('debug-panel.js: demoReset ref', debugPanel.includes("'demoReset'"));
check('debug-panel.js: renderDemoPanel() method', debugPanel.includes('renderDemoPanel(s)'));
check('debug-panel.js: scDemoPresetCreate click listener', debugPanel.includes("scDemoPresetCreate.addEventListener('click'"));
check('debug-panel.js: scDemoFierceFollowUp click listener', debugPanel.includes("scDemoFierceFollowUp.addEventListener('click'"));
check('debug-panel.js: scDemoEnemyDamage click listener', debugPanel.includes("scDemoEnemyDamage.addEventListener('click'"));
check('debug-panel.js: scDemoReset click listener', debugPanel.includes("scDemoReset.addEventListener('click'"));
check('debug-panel.js: demoStart click listener', debugPanel.includes("demoStart.addEventListener('click'"));
check('debug-panel.js: demoReset click listener', debugPanel.includes("demoReset.addEventListener('click'"));
check('debug-panel.js: createDemoHudModel called with isDemo', debugPanel.includes('createDemoHudModel(s, { isDemo })'));

const canvasRenderer = readFileSync(resolve(root, 'src/ui/canvas-renderer.js'), 'utf-8');

check('canvas-renderer.js: DEMO badge drawn', canvasRenderer.includes("fillText('DEMO'"));

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
