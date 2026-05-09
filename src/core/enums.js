export const ActionPhase = Object.freeze({
  None: 'None',
  Startup: 'Startup',
  Active: 'Active',
  Recovery: 'Recovery',
  Finished: 'Finished',
});

export const ActorState = Object.freeze({
  Locomotion: 'Locomotion',
  AutoAttack: 'AutoAttack',
  Art: 'Art',
});

export const ActionKind = Object.freeze({
  AutoAttack: 'AutoAttack',
  Art: 'Art',
});

export const CombatEventType = Object.freeze({
  Init: 'Init',
  Reset: 'Reset',
  InputBuffered: 'InputBuffered',
  InputConsumed: 'InputConsumed',
  InputExpired: 'InputExpired',
  ActionStarted: 'ActionStarted',
  ActionPhaseChanged: 'ActionPhaseChanged',
  ActionHit: 'ActionHit',
  ActionWhiffed: 'ActionWhiffed',
  ActionFinished: 'ActionFinished',
  ArtChargeChanged: 'ArtChargeChanged',
  ArtBecameReady: 'ArtBecameReady',
  ArtConsumed: 'ArtConsumed',
  CancelBonusWindowOpened: 'CancelBonusWindowOpened',
  CancelBonusApplied: 'CancelBonusApplied',
  RecoveryCanceledToMovement: 'RecoveryCanceledToMovement',
  RecoveryCanceledToArt: 'RecoveryCanceledToArt',
  AutoAttackChainAdvanced: 'AutoAttackChainAdvanced',
  AutoAttackChainReset: 'AutoAttackChainReset',
});
