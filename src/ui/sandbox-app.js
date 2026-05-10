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
    this.driverComboRefs = {
      stage: this.byId('dcStage'),
      bar: this.byId('dcBar'),
      framesLeft: this.byId('dcFramesLeft'),
      duration: this.byId('dcDuration'),
    };
    this.accumulator = 0;
    this.lastTimestamp = 0;
    this.fixedDeltaSeconds = 1 / 60;

    this.loop = this.loop.bind(this);
  }

  byId(id) {
    const element = this.document.getElementById(id);
    if (!element) throw new Error(`Missing sandbox element #${id}`);
    return element;
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

  renderDriverCombo(driverCombo) {
    const stage = driverCombo?.stage ?? 'None';
    const framesLeft = Math.max(0, Number(driverCombo?.framesLeft ?? 0));
    const duration = Math.max(0, Number(driverCombo?.duration ?? 0));
    const ratio = duration > 0 ? Math.max(0, Math.min(1, framesLeft / duration)) : 0;

    this.driverComboRefs.stage.textContent = stage;
    this.driverComboRefs.bar.style.width = `${Math.round(ratio * 100)}%`;
    this.driverComboRefs.framesLeft.textContent = String(framesLeft | 0);
    this.driverComboRefs.duration.textContent = String(duration | 0);
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
    this.renderDriverCombo(snapshot.driverCombo);
    this.window.requestAnimationFrame(this.loop);
  }
}

export function startSandboxApp(options = {}) {
  const app = new SandboxApp(options);
  app.start();
  return app;
}
