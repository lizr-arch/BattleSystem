import { CombatInputFrame } from '../core/combat-input.js';

export class BrowserInput {
  constructor(windowObject = window) {
    this.window = windowObject;
    this.keys = new Set();
    this.oneShot = {
      art1: false,
      art2: false,
      art3: false,
      art4: false,
      sp1: false,
      sp2: false,
      sp3: false,
      pause: false,
      reset: false,
      step: false,
    };

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  attach() {
    this.window.addEventListener('keydown', this.onKeyDown);
    this.window.addEventListener('keyup', this.onKeyUp);
  }

  detach() {
    this.window.removeEventListener('keydown', this.onKeyDown);
    this.window.removeEventListener('keyup', this.onKeyUp);
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', '1', '2', '3', '4', '.'].includes(key)) {
      event.preventDefault();
    }
    if ((event.ctrlKey || event.metaKey) && ['q', 'w', 'e'].includes(key)) {
      event.preventDefault();
    }

    if (!this.keys.has(key)) {
      if (key === '1') this.oneShot.art1 = true;
      if (key === '2') this.oneShot.art2 = true;
      if (key === '3') this.oneShot.art3 = true;
      if (key === '4') this.oneShot.art4 = true;
      if ((event.ctrlKey || event.metaKey) && key === 'q') this.oneShot.sp1 = true;
      if ((event.ctrlKey || event.metaKey) && key === 'w') this.oneShot.sp2 = true;
      if ((event.ctrlKey || event.metaKey) && key === 'e') this.oneShot.sp3 = true;
      if (key === ' ') this.oneShot.pause = true;
      if (key === 'r') this.oneShot.reset = true;
      if (key === '.') this.oneShot.step = true;
    }

    this.keys.add(key);
  }

  onKeyUp(event) {
    this.keys.delete(event.key.toLowerCase());
  }

  consumeControlShots() {
    const result = {
      pause: this.oneShot.pause,
      reset: this.oneShot.reset,
      step: this.oneShot.step,
      sp1: this.oneShot.sp1,
      sp2: this.oneShot.sp2,
      sp3: this.oneShot.sp3,
    };

    this.oneShot.pause = false;
    this.oneShot.reset = false;
    this.oneShot.step = false;
    this.oneShot.sp1 = false;
    this.oneShot.sp2 = false;
    this.oneShot.sp3 = false;

    return result;
  }

  readCombatFrame() {
    let moveX = 0;
    let moveY = 0;

    if (this.keys.has('a') || this.keys.has('arrowleft')) moveX -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) moveX += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) moveY -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) moveY += 1;

    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    const artSlotsPressed = [];
    if (this.oneShot.art1) artSlotsPressed.push(0);
    if (this.oneShot.art2) artSlotsPressed.push(1);
    if (this.oneShot.art3) artSlotsPressed.push(2);
    if (this.oneShot.art4) artSlotsPressed.push(3);
    this.oneShot.art1 = false;
    this.oneShot.art2 = false;
    this.oneShot.art3 = false;
    this.oneShot.art4 = false;

    return new CombatInputFrame({ moveX, moveY, artSlotsPressed });
  }
}
