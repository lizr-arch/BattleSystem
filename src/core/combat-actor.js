import { CombatActionInstance } from './action.js';
import { CombatCommandBuffer, CombatInputFrame } from './combat-input.js';
import { CombatEventLog } from './combat-event-log.js';
import { ActorState, CombatEventType } from './enums.js';
import { clamp, distance, normalize2 } from './math.js';

export class CombatActor {
  constructor({
    id = 'Player',
    position = { x: 310, y: 400 },
    target = { id: 'Dummy', x: 660, y: 400, radius: 38, hp: 999999 },
    radius = 24,
    autoAttackRange = 165,
    artRange = 190,
    moveSpeed = 3.2,
    moveDeadZone = 0.1,
    worldBounds = { minX: 40, maxX: 1160, minY: 70, maxY: 730 },
    autoAttackChain,
    arts,
    inputBufferFrames = 10,
    cancelBonusFrames = 15,
    eventLog = new CombatEventLog()
  }) {
    if (!autoAttackChain) throw new Error('CombatActor requires autoAttackChain.');
    if (!Array.isArray(arts)) throw new Error('CombatActor requires arts array.');

    this.id = id;
    this.x = position.x;
    this.y = position.y;
    this.radius = radius;

    this.target = target;
    this.autoAttackRange = autoAttackRange;
    this.artRange = artRange;
    this.moveSpeed = moveSpeed;
    this.moveDeadZone = moveDeadZone;
    this.worldBounds = worldBounds;

    this.autoAttackChain = autoAttackChain;
    this.arts = arts;

    this.state = ActorState.Locomotion;
    this.action = null;
    this.currentArt = null;
    this.currentArtCanceled = false;
    this.autoAttackIndex = autoAttackChain.firstIndex;

    this.frame = 0;
    this.cancelBonusFrames = cancelBonusFrames;
    this.cancelBonusLeft = 0;

    this.eventLog = eventLog;
    this.commandBuffer = new CombatCommandBuffer({
      maxFrames: inputBufferFrames,
      eventLog: this.eventLog,
      getFrame: () => this.frame
    });

    this.vfx = [];
    this.paused = false;

    this.log(CombatEventType.Init, 'Init combat actor');
  }

  log(type, message, data = {}) {
    return this.eventLog.push(this.frame, type, message, data);
  }

  consumeEvents() {
    return this.eventLog.consumeUnread();
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  distToTarget() {
    return distance(this, this.target);
  }

  inAutoRange() {
    return this.distToTarget() <= this.autoAttackRange;
  }

  inArtRange() {
    return this.distToTarget() <= this.artRange;
  }

  currentPhase() {
    return this.action ? this.action.phase : 'None';
  }

  canStartAutoAttack(moveIntent) {
    return !moveIntent && this.inAutoRange() && this.state !== ActorState.Dead;
  }

  setInputBufferFrames(frames) {
    this.commandBuffer.setMaxFrames(frames);
  }

  setCancelBonusFrames(frames) {
    this.cancelBonusFrames = Math.max(0, frames | 0);
    this.cancelBonusLeft = Math.min(this.cancelBonusLeft, this.cancelBonusFrames);
  }

  resetRuntime({ keepLog = false } = {}) {
    this.x = 310;
    this.y = 400;
    this.state = ActorState.Locomotion;
    this.action = null;
    this.currentArt = null;
    this.currentArtCanceled = false;
    this.autoAttackIndex = this.autoAttackChain.firstIndex;
    this.frame = 0;
    this.cancelBonusLeft = 0;
    this.commandBuffer.clear();
    this.arts.forEach((art) => { art.charge = 0; });
    this.vfx = [];
    this.paused = false;

    if (!keepLog) this.eventLog.clear();
    this.log(CombatEventType.Reset, 'Reset combat actor');
  }

  tick(rawInput = new CombatInputFrame()) {
    const input = rawInput instanceof CombatInputFrame
      ? rawInput
      : new CombatInputFrame(rawInput);

    this.frame += 1;
    this.commandBuffer.tick();

    if (this.cancelBonusLeft > 0) {
      this.cancelBonusLeft -= 1;
    }

    for (const slot of input.artSlotsPressed) {
      this.commandBuffer.bufferArt(slot);
    }

    const moveIntent = input.hasMoveIntent(this.moveDeadZone);

    switch (this.state) {
      case ActorState.Art:
        this.tickArtState(input, moveIntent);
        break;
      case ActorState.AutoAttack:
        this.tickAutoAttackState(input, moveIntent);
        break;
      case ActorState.Locomotion:
      default:
        this.tickLocomotionState(input, moveIntent);
        break;
    }

    this.tickVfx();
  }

  tickLocomotionState(input, moveIntent) {
    this.applyMovement(input, moveIntent);

    if (this.tryUseBufferedReadyArt({ requireAutoRecoveryCancel: false })) {
      return;
    }

    if (this.canStartAutoAttack(moveIntent)) {
      this.startAutoAttack();
    }
  }

  tickAutoAttackState(input, moveIntent) {
    this.tickCurrentAction();

    if (this.action?.shouldFireHit()) {
      this.onAutoAttackHit(this.action.spec);
    }

    if (this.action?.spec.canCancelToArt(this.action.elapsedFrames)) {
      if (this.tryUseBufferedReadyArt({ requireAutoRecoveryCancel: true })) {
        return;
      }
    }

    if (this.action?.spec.canCancelToMovement(this.action.elapsedFrames) && moveIntent) {
      this.log(
        CombatEventType.RecoveryCanceledToMovement,
        `RecoveryCanceledToMovement ${this.action.spec.id}`,
        { actionId: this.action.spec.id }
      );
      this.action = null;
      this.cancelBonusLeft = 0;
      this.resetAutoAttackChain();
      this.state = ActorState.Locomotion;
      this.applyMovement(input, moveIntent);
      return;
    }

    if (this.action?.isFinished()) {
      const finishedSpec = this.action.spec;
      this.log(
        CombatEventType.ActionFinished,
        `ActionFinished ${finishedSpec.id}`,
        { actionId: finishedSpec.id }
      );
      this.action = null;
      this.advanceAutoAttackChain();

      if (this.canStartAutoAttack(moveIntent)) {
        this.startAutoAttack();
      } else {
        this.resetAutoAttackChain();
        this.state = ActorState.Locomotion;
      }
    }
  }

  tickArtState(input, moveIntent) {
    this.tickCurrentAction();

    if (this.action?.shouldFireHit()) {
      this.onArtHit(this.currentArt, this.currentArtCanceled);
    }

    if (this.action?.isFinished()) {
      this.log(
        CombatEventType.ActionFinished,
        `ActionFinished ${this.currentArt.id}`,
        { artId: this.currentArt.id }
      );

      this.action = null;
      this.currentArt = null;
      this.currentArtCanceled = false;
      this.resetAutoAttackChain();

      if (this.canStartAutoAttack(moveIntent)) {
        this.startAutoAttack();
      } else {
        this.state = ActorState.Locomotion;
      }
    }
  }

  tickCurrentAction() {
    if (!this.action) return;

    const before = this.action.phase;
    this.action.tick();
    const after = this.action.phase;

    if (before !== after) {
      this.log(
        CombatEventType.ActionPhaseChanged,
        `ActionPhaseChanged ${this.action.spec.id} ${before}->${after}`,
        { actionId: this.action.spec.id, before, after }
      );
    }
  }

  applyMovement(input, moveIntent) {
    if (!moveIntent) return;

    const n = normalize2(input.moveX, input.moveY);
    this.x += n.x * this.moveSpeed;
    this.y += n.y * this.moveSpeed;
    this.x = clamp(this.x, this.worldBounds.minX, this.worldBounds.maxX);
    this.y = clamp(this.y, this.worldBounds.minY, this.worldBounds.maxY);
  }

  startAutoAttack() {
    const spec = this.autoAttackChain.getStage(this.autoAttackIndex);
    this.action = new CombatActionInstance(spec);
    this.state = ActorState.AutoAttack;
    this.log(CombatEventType.ActionStarted, `ActionStarted ${spec.id}`, { actionId: spec.id });
  }

  startArt(art, canceled) {
    this.action = new CombatActionInstance(art.actionSpec);
    this.state = ActorState.Art;
    this.currentArt = art;
    this.currentArtCanceled = canceled;
    art.consume();

    this.log(CombatEventType.ArtConsumed, `ArtConsumed ${art.id}`, { artId: art.id });
    this.log(
      CombatEventType.ActionStarted,
      `ActionStarted ${art.id}${canceled ? ' [CANCEL]' : ''}`,
      { artId: art.id, canceled }
    );
  }

  tryUseBufferedReadyArt({ requireAutoRecoveryCancel }) {
    if (!this.commandBuffer.hasArt()) return false;

    const slot = this.commandBuffer.peekArtSlot();
    const art = this.arts[slot];
    if (!art || !art.ready || !this.inArtRange()) return false;

    let canceled = false;

    if (this.state === ActorState.AutoAttack && this.action) {
      if (!this.action.spec.canCancelToArt(this.action.elapsedFrames)) {
        return false;
      }

      canceled = this.cancelBonusLeft > 0;

      this.log(
        CombatEventType.RecoveryCanceledToArt,
        `RecoveryCanceledToArt ${this.action.spec.id} -> ${art.id}`,
        { fromActionId: this.action.spec.id, artId: art.id }
      );
    } else if (requireAutoRecoveryCancel) {
      return false;
    }

    this.commandBuffer.consumeArt();

    if (canceled) {
      this.log(CombatEventType.CancelBonusApplied, `CancelBonusApplied ${art.id}`, { artId: art.id });
    }

    this.startArt(art, canceled);
    return true;
  }

  onAutoAttackHit(spec) {
    if (!this.inAutoRange()) {
      this.log(CombatEventType.ActionWhiffed, `ActionWhiffed ${spec.id}`, { actionId: spec.id });
      return;
    }

    this.log(
      CombatEventType.ActionHit,
      `ActionHit ${spec.id} damage=${spec.damage}`,
      { actionId: spec.id, damage: spec.damage }
    );
    this.spawnDamageNumber(spec.damage, 'hit');

    for (const art of this.arts) {
      const result = art.addCharge(spec.artChargeGain);
      if (result.before !== result.after) {
        this.log(
          CombatEventType.ArtChargeChanged,
          `ArtChargeChanged ${art.id} ${result.before}->${result.after}`,
          { artId: art.id, before: result.before, after: result.after }
        );
      }

      if (result.becameReady) {
        this.log(CombatEventType.ArtBecameReady, `ArtBecameReady ${art.id}`, { artId: art.id });
      }
    }

    this.cancelBonusLeft = this.cancelBonusFrames;
    this.log(
      CombatEventType.CancelBonusWindowOpened,
      `CancelBonusWindowOpened ${this.cancelBonusFrames}f`,
      { frames: this.cancelBonusFrames }
    );
  }

  onArtHit(art, canceled) {
    if (!this.inArtRange()) {
      this.log(CombatEventType.ActionWhiffed, `ActionWhiffed ${art.id}`, { artId: art.id });
      return;
    }

    const damage = Math.round(art.actionSpec.damage * (canceled ? 1.2 : 1));
    this.log(
      CombatEventType.ActionHit,
      `ActionHit ${art.id} damage=${damage}${canceled ? ' [bonus]' : ''}`,
      { artId: art.id, damage, canceled }
    );
    this.spawnDamageNumber(damage, canceled ? 'cancel-art' : 'art');
  }

  resetAutoAttackChain() {
    if (this.autoAttackIndex !== this.autoAttackChain.firstIndex) {
      this.log(CombatEventType.AutoAttackChainReset, 'AutoAttackChainReset');
    }

    this.autoAttackIndex = this.autoAttackChain.firstIndex;
  }

  advanceAutoAttackChain() {
    this.autoAttackIndex = this.autoAttackChain.getNextIndex(this.autoAttackIndex);
    this.log(
      CombatEventType.AutoAttackChainAdvanced,
      `AutoAttackChainAdvanced -> ${this.autoAttackChain.getStage(this.autoAttackIndex).id}`,
      { nextActionId: this.autoAttackChain.getStage(this.autoAttackIndex).id }
    );
  }

  spawnDamageNumber(text, kind) {
    this.vfx.push({
      x: this.target.x,
      y: this.target.y + (kind === 'hit' ? 0 : -18),
      life: kind === 'hit' ? 16 : 22,
      text: String(text),
      kind
    });
  }

  tickVfx() {
    for (const fx of this.vfx) {
      fx.life -= 1;
      fx.y -= 0.55;
    }

    this.vfx = this.vfx.filter((fx) => fx.life > 0);
  }
}
