import { createDefaultCombatActor } from '../data/default-combat-config.js';
import { CombatInputFrame } from '../core/combat-input.js';
import { BrowserInput } from './browser-input.js';
import { CanvasRenderer } from './canvas-renderer.js';
import { DebugPanel } from './debug-panel.js';
import { createDemoBattlePreset, resetDemoPreset } from '../dev/demo-battle-preset.js';

export class SandboxApp {
  constructor({ windowObject = window, documentObject = document } = {}) {
    this.window = windowObject;
    this.document = documentObject;
    this.actor = createDefaultCombatActor();
    this.input = new BrowserInput(this.window);
    this.renderer = new CanvasRenderer(this.document.getElementById('c'));
    this.debugPanel = new DebugPanel({ documentObject: this.document, actor: this.actor });
    this.accumulator = 0;
    this.lastTimestamp = 0;
    this.fixedDeltaSeconds = 1 / 60;
    this.isDemo = false;

    this.loop = this.loop.bind(this);
  }

  start() {
    this.input.attach();
    this.debugPanel.bindControls({
      onPause: () => { this.actor.paused = !this.actor.paused; },
      onStep: () => this.stepOneFrame(),
      onReset: () => this.reset(),
      onClear: () => this.actor.eventLog.clear(),
      onMvpRunScenario: () => {
        this.debugPanel.runScenario('single-driver-routine-orb-victory');
        this.renderOnce();
      },
      onMvpGrantTiles: () => {
        this.actor.paused = true;
        this.actor.emit('DebugGrantRoutineTiles', { requested: 3 });
        this.debugPanel.grantAllArtsReady();
        this.ensureCloseToTarget();
        this.castFireSkill(0);
        this.fastForwardUntil((s) => s.state === 'Locomotion' || s.battle?.active === false, 1200);
        this.castFireSkill(1);
        this.fastForwardUntil((s) => s.state === 'Locomotion' || s.battle?.active === false, 1200);
        this.castFireSkill(2);
        this.fastForwardUntil((s) => s.routineOrb !== null || s.battle?.active === false, 1800);
        this.renderOnce();
      },
      onMvpCastSkill1: () => { this.castFireSkill(0); this.renderOnce(); },
      onMvpCastSkill2: () => { this.castFireSkill(1); this.renderOnce(); },
      onMvpCastSkill3: () => { this.castFireSkill(2); this.renderOnce(); },
      onMvpBreakOrb: () => {
        this.actor.paused = true;
        this.actor.breakRoutineOrb();
        this.renderOnce();
      },
      onDemoStart: () => {
        this.loadDemoPreset();
        this.renderOnce();
      },
      onDemoReset: () => {
        if (this.isDemo) {
          resetDemoPreset(this.actor);
          this.renderOnce();
        }
      },
    });

    this.lastTimestamp = performance.now();
    this.window.requestAnimationFrame(this.loop);
  }

  ensureCloseToTarget() {
    const s = this.actor.getSnapshot();
    const tx = Number(s.target?.x ?? 0);
    const ty = Number(s.target?.y ?? 0);
    this.actor.x = tx - 100;
    this.actor.y = ty;
    this.actor.autoAttackRange = 0;
  }

  castFireSkill(slot) {
    this.actor.paused = true;
    this.actor.tick(new CombatInputFrame({ artSlotsPressed: [slot] }));
  }

  fastForwardUntil(predicate, maxFrames) {
    this.actor.paused = true;
    const max = Math.max(0, Number(maxFrames ?? 0) | 0);
    for (let i = 0; i < max; i += 1) {
      const s = this.actor.getSnapshot();
      if (predicate(s)) break;
      this.actor.tick(new CombatInputFrame());
    }
  }

  renderOnce() {
    const snapshot = this.actor.getSnapshot();
    this.renderer.draw(snapshot);
    this.debugPanel.render(snapshot);
  }

  reset() {
    this.actor.resetRuntime();
    this.debugPanel.applyTuning();
  }

  loadDemoPreset() {
    this.actor.resetRuntime();
    this.actor = createDemoBattlePreset({
      createActor: ({ target, enemyStrike, playerHp, playerMaxHp, position, resolvedLoadout }) => {
        const actor = createDefaultCombatActor();
        actor.target = target;
        actor.player.hp = playerHp;
        actor.player.maxHp = playerMaxHp;
        actor.x = position.x;
        actor.y = position.y;
        actor.resolvedLoadout = resolvedLoadout;
        if (actor.enemy) {
          actor.enemy.strike = enemyStrike;
        }
        actor.refreshBladeUnlocks?.();
        return actor;
      },
    });
    this.isDemo = true;
    this.debugPanel.actor = this.actor;
    this.debugPanel.isDemo = true;
  }

  resetDemo() {
    if (this.isDemo) {
      resetDemoPreset(this.actor);
      this.renderOnce();
    }
  }

  stepOneFrame() {
    this.actor.paused = true;
    this.actor.tick(this.input.readCombatFrame());
  }

  loop(timestamp) {
    const controls = this.input.consumeControlShots();
    if (controls.pause) this.actor.paused = !this.actor.paused;
    if (controls.reset) this.reset();
    if (controls.step) this.stepOneFrame();
    if (controls.sp1) this.actor.castSpecial('FireLv1');
    if (controls.sp2) this.actor.castSpecial('WaterLv2');
    if (controls.sp3) this.actor.castSpecial('FireLv3');

    const elapsedSeconds = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this.accumulator += elapsedSeconds;

    if (!this.actor.paused) {
      while (this.accumulator >= this.fixedDeltaSeconds) {
        this.actor.tick(this.input.readCombatFrame());
        this.accumulator -= this.fixedDeltaSeconds;
      }
    } else {
      this.accumulator = 0;
    }

    const snapshot = this.actor.getSnapshot();
    this.renderer.draw(snapshot);
    this.debugPanel.render(snapshot);
    this.window.requestAnimationFrame(this.loop);
  }
}

export function startSandboxApp(options = {}) {
  const app = new SandboxApp(options);
  app.start();
  return app;
}
