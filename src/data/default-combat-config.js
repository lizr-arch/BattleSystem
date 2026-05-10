import { AutoAttackChainSpec, CombatActionSpec } from '../core/action.js';
import { Art } from '../core/art.js';
import { CombatActor } from '../core/combat-actor.js';
import { ActionKind, BladeComboElement, DriverComboEffect } from '../core/enums.js';
import { Special } from '../core/special.js';

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
    damage: 40,
    artChargeGain: 0,
    cancelRecoveryToMovement: false,
    cancelRecoveryToArt: false
  });

  const art2Action = new CombatActionSpec({
    id: 'Art2_Action',
    kind: ActionKind.Art,
    startupFrames: 15,
    activeFrames: 4,
    recoveryFrames: 28,
    damage: 50,
    artChargeGain: 0,
    cancelRecoveryToMovement: false,
    cancelRecoveryToArt: false
  });

  const art3Action = new CombatActionSpec({
    id: 'Art3_Action',
    kind: ActionKind.Art,
    startupFrames: 15,
    activeFrames: 4,
    recoveryFrames: 28,
    damage: 60,
    artChargeGain: 0,
    cancelRecoveryToMovement: false,
    cancelRecoveryToArt: false
  });

  const art4Action = new CombatActionSpec({
    id: 'Art4_Action',
    kind: ActionKind.Art,
    startupFrames: 15,
    activeFrames: 4,
    recoveryFrames: 28,
    damage: 80,
    artChargeGain: 0,
    cancelRecoveryToMovement: false,
    cancelRecoveryToArt: false
  });

  const fireLv1Action = new CombatActionSpec({
    id: 'FireLv1_Action',
    kind: ActionKind.Art,
    startupFrames: 20,
    activeFrames: 4,
    recoveryFrames: 36,
    damage: 120,
    artChargeGain: 0,
    cancelRecoveryToMovement: false,
    cancelRecoveryToArt: false
  });

  const waterLv2Action = new CombatActionSpec({
    id: 'WaterLv2_Action',
    kind: ActionKind.Art,
    startupFrames: 22,
    activeFrames: 4,
    recoveryFrames: 38,
    damage: 180,
    artChargeGain: 0,
    cancelRecoveryToMovement: false,
    cancelRecoveryToArt: false
  });

  const fireLv3Action = new CombatActionSpec({
    id: 'FireLv3_Action',
    kind: ActionKind.Art,
    startupFrames: 24,
    activeFrames: 5,
    recoveryFrames: 40,
    damage: 240,
    artChargeGain: 0,
    cancelRecoveryToMovement: false,
    cancelRecoveryToArt: false
  });

  return {
    aa1,
    aa2,
    aa3,
    art1Action,
    art2Action,
    art3Action,
    art4Action,
    fireLv1Action,
    waterLv2Action,
    fireLv3Action
  };
}

export function createDefaultCombatActor() {
  const specs = createDefaultActionSpecs();
  const autoAttackChain = new AutoAttackChainSpec([specs.aa1, specs.aa2, specs.aa3]);
  const arts = [
    new Art({
      id: 'Art1',
      actionSpec: specs.art1Action,
      maxCharge: 2,
      effect: DriverComboEffect.Break,
      specialChargeGain: 25
    }),
    new Art({
      id: 'Art2',
      actionSpec: specs.art2Action,
      maxCharge: 3,
      effect: DriverComboEffect.Topple,
      specialChargeGain: 25
    }),
    new Art({
      id: 'Art3',
      actionSpec: specs.art3Action,
      maxCharge: 4,
      effect: DriverComboEffect.Launch,
      specialChargeGain: 30
    }),
    new Art({
      id: 'Art4',
      actionSpec: specs.art4Action,
      maxCharge: 4,
      effect: DriverComboEffect.Smash,
      specialChargeGain: 40
    })
  ];
  const specials = [
    new Special({ id: 'FireLv1', actionSpec: specs.fireLv1Action, level: 1, element: BladeComboElement.Fire, damage: 120 }),
    new Special({ id: 'WaterLv2', actionSpec: specs.waterLv2Action, level: 2, element: BladeComboElement.Water, damage: 180 }),
    new Special({ id: 'FireLv3', actionSpec: specs.fireLv3Action, level: 3, element: BladeComboElement.Fire, damage: 240 })
  ];
  const bladeComboRoutes = [
    {
      id: 'FireWaterFire',
      durationFrames: 240,
      tokenId: 'FireToken',
      steps: [
        { element: BladeComboElement.Fire, minLevel: 1 },
        { element: BladeComboElement.Water, minLevel: 2 },
        { element: BladeComboElement.Fire, minLevel: 3 },
      ],
    },
  ];

  const target = { id: 'Dummy', x: 660, y: 400, radius: 38, hp: 999999 };
  const position = { x: target.x - 100, y: target.y };

  return new CombatActor({
    id: 'Player',
    position,
    target,
    radius: 24,
    autoAttackRange: 165,
    artRange: 190,
    moveSpeed: 3.2,
    moveDeadZone: 0.1,
    autoAttackChain,
    arts,
    specials,
    bladeComboRoutes,
    inputBufferFrames: 10,
    cancelBonusFrames: 15,
    cancelBonusDamageMultiplier: 1.2
  });
}
