import { AutoAttackChainSpec, CombatActionSpec } from '../core/action.js';
import { Art } from '../core/art.js';
import { CombatActor } from '../core/combat-actor.js';
import { ActionKind } from '../core/enums.js';

export function createDefaultActionSpecs() {
  const aa1 = new CombatActionSpec({
    id: 'AA1',
    kind: ActionKind.AutoAttack,
    startupFrames: 18,
    activeFrames: 2,
    recoveryFrames: 24,
    damage: 10,
    artChargeGain: 1,
    cancelRecoveryToMovement: true,
    cancelRecoveryToArt: true
  });

  const aa2 = new CombatActionSpec({
    id: 'AA2',
    kind: ActionKind.AutoAttack,
    startupFrames: 22,
    activeFrames: 2,
    recoveryFrames: 28,
    damage: 14,
    artChargeGain: 1,
    cancelRecoveryToMovement: true,
    cancelRecoveryToArt: true
  });

  const aa3 = new CombatActionSpec({
    id: 'AA3',
    kind: ActionKind.AutoAttack,
    startupFrames: 30,
    activeFrames: 2,
    recoveryFrames: 36,
    damage: 24,
    artChargeGain: 2,
    cancelRecoveryToMovement: true,
    cancelRecoveryToArt: true
  });

  const art1Action = new CombatActionSpec({
    id: 'Art1_Action',
    kind: ActionKind.Art,
    startupFrames: 15,
    activeFrames: 4,
    recoveryFrames: 28,
    damage: 70,
    artChargeGain: 0,
    cancelRecoveryToMovement: false,
    cancelRecoveryToArt: false
  });

  return { aa1, aa2, aa3, art1Action };
}

export function createDefaultCombatActor() {
  const specs = createDefaultActionSpecs();
  const autoAttackChain = new AutoAttackChainSpec([specs.aa1, specs.aa2, specs.aa3]);
  const arts = [
    new Art({
      id: 'Art1',
      actionSpec: specs.art1Action,
      maxCharge: 3
    })
  ];

  return new CombatActor({
    id: 'Player',
    position: { x: 310, y: 400 },
    target: { id: 'Dummy', x: 660, y: 400, radius: 38, hp: 999999 },
    radius: 24,
    autoAttackRange: 165,
    artRange: 190,
    moveSpeed: 3.2,
    moveDeadZone: 0.1,
    autoAttackChain,
    arts,
    inputBufferFrames: 10,
    cancelBonusFrames: 15
  });
}
