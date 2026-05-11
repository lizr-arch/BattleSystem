import { createDefaultCombatActor } from '../data/default-combat-config.js';
import { BrowserInput } from './browser-input.js';
import { CanvasRenderer } from './canvas-renderer.js';
import { DebugPanel } from './debug-panel.js';

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

    this.loop = this.loop.bind(this);
  }

  start() {
    this.input.attach();
    this.debugPanel.bindControls({
      onPause: () => { this.actor.paused = !this.actor.paused; },
      onStep: () => this.stepOneFrame(),
      onReset: () => this.reset(),
      onClear: () => this.actor.eventLog.clear(),
    });

    this.lastTimestamp = performance.now();
    this.window.requestAnimationFrame(this.loop);
  }

  reset() {
    this.actor.resetRuntime();
    this.debugPanel.applyTuning();
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
