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

export const DriverComboStage = Object.freeze({
  None: 'None',
  Break: 'Break',
  Topple: 'Topple',
  Launch: 'Launch',
});

export const DriverComboEffect = Object.freeze({
  Break: 'Break',
  Topple: 'Topple',
  Launch: 'Launch',
  Smash: 'Smash',
});

export const CombatEventType = Object.freeze({
  Init: 'Init',
  Reset: 'Reset',
  InputBuffered: 'InputBuffered',
  InputConsumed: 'InputConsumed',
  InputExpired: 'InputExpired',
  DebugGrantArtsReady: 'DebugGrantArtsReady',
  ActionStarted: 'ActionStarted',
  ActionPhaseChanged: 'ActionPhaseChanged',
  ActionHit: 'ActionHit',
  ActionWhiffed: 'ActionWhiffed',
  ActionFinished: 'ActionFinished',
  ArtChargeChanged: 'ArtChargeChanged',
  ArtBecameReady: 'ArtBecameReady',
  ArtConsumed: 'ArtConsumed',
  SpecialChargeChanged: 'SpecialChargeChanged',
  SpecialBecameReady: 'SpecialBecameReady',
  SpecialConsumed: 'SpecialConsumed',
  SpecialCastFailed: 'SpecialCastFailed',
  SpecialHit: 'SpecialHit',
  CancelBonusWindowOpened: 'CancelBonusWindowOpened',
  CancelBonusApplied: 'CancelBonusApplied',
  RecoveryCanceledToMovement: 'RecoveryCanceledToMovement',
  RecoveryCanceledToArt: 'RecoveryCanceledToArt',
  AutoAttackChainAdvanced: 'AutoAttackChainAdvanced',
  AutoAttackChainReset: 'AutoAttackChainReset',
  DriverComboApplied: 'DriverComboApplied',
  DriverComboAdvanced: 'DriverComboAdvanced',
  DriverComboRefreshed: 'DriverComboRefreshed',
  DriverComboFailed: 'DriverComboFailed',
  DriverComboExpired: 'DriverComboExpired',
  DriverComboFinished: 'DriverComboFinished',
});
