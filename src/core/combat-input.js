import { CombatEventType } from './enums.js';
import { emitCombatEvent } from './combat-events.js';

export class CombatInputFrame {
  constructor({ moveX = 0, moveY = 0, artSlotsPressed = [] } = {}) {
    this.moveX = moveX;
    this.moveY = moveY;
    this.artSlotsPressed = artSlotsPressed;
  }

  hasMoveIntent(deadZone = 0.1) {
    return this.moveX * this.moveX + this.moveY * this.moveY > deadZone * deadZone;
  }
}

export class CombatCommandBuffer {
  constructor({ maxFrames = 10, eventLog = null, getFrame = () => 0 } = {}) {
    this.maxFrames = maxFrames;
    this.eventLog = eventLog;
    this.getFrame = getFrame;
    this.artSlot = null;
    this.framesLeft = 0;
  }

  setMaxFrames(maxFrames) {
    this.maxFrames = Math.max(0, maxFrames | 0);
    this.framesLeft = Math.min(this.framesLeft, this.maxFrames);
    if (this.framesLeft <= 0) this.artSlot = null;
  }

  bufferArt(slot) {
    if (this.maxFrames <= 0) return;

    this.artSlot = slot;
    this.framesLeft = this.maxFrames;
    if (this.eventLog) {
      emitCombatEvent(this.eventLog, this.getFrame(), CombatEventType.InputBuffered, { slot, frames: this.maxFrames });
    }
  }

  tick() {
    if (this.framesLeft <= 0) return;

    this.framesLeft -= 1;

    if (this.framesLeft <= 0) {
      const expiredSlot = this.artSlot;
      this.artSlot = null;
      this.framesLeft = 0;
      if (this.eventLog) {
        emitCombatEvent(this.eventLog, this.getFrame(), CombatEventType.InputExpired, { slot: expiredSlot });
      }
    }
  }

  hasArt() {
    return this.artSlot !== null && this.framesLeft > 0;
  }

  peekArtSlot() {
    return this.hasArt() ? this.artSlot : null;
  }

  consumeArt() {
    const slot = this.artSlot;
    this.artSlot = null;
    this.framesLeft = 0;

    if (slot !== null) {
      if (this.eventLog) {
        emitCombatEvent(this.eventLog, this.getFrame(), CombatEventType.InputConsumed, { slot });
      }
    }

    return slot;
  }

  clear() {
    this.artSlot = null;
    this.framesLeft = 0;
  }

  ratio() {
    if (this.maxFrames <= 0) return 0;
    return Math.max(0, Math.min(1, this.framesLeft / this.maxFrames));
  }
}
