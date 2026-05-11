import { CombatEventType } from './enums.js';

export function formatCombatEvent(type, data = {}) {
  switch (type) {
    case CombatEventType.Init:
      return 'Init';
    case CombatEventType.Reset:
      return 'Reset';
    case CombatEventType.InputBuffered:
      return `InputBuffered UseArt${(data.slot ?? 0) + 1} ${data.frames ?? 0}f`;
    case CombatEventType.InputConsumed:
      return `InputConsumed UseArt${(data.slot ?? 0) + 1}`;
    case CombatEventType.InputExpired:
      return `InputExpired UseArt${(data.slot ?? 0) + 1}`;
    case CombatEventType.DebugGrantArtsReady: {
      const parts = [];
      for (const [id, v] of Object.entries(data || {})) {
        const charge = v?.charge ?? 0;
        const maxCharge = v?.maxCharge ?? 0;
        parts.push(`${id}=${charge}/${maxCharge}`);
      }
      return `DebugGrantArtsReady ${parts.join(' ')}`.trimEnd();
    }
    case CombatEventType.DebugGrantSpecialReady:
      return `DebugGrantSpecialReady charge=${data.charge ?? 0}${data.level ? ` L${data.level}` : ''}`;
    case CombatEventType.ActionStarted:
      return `ActionStarted ${data.actionId ?? data.artId ?? 'Unknown'}`;
    case CombatEventType.ActionPhaseChanged:
      return `ActionPhaseChanged ${data.actionId ?? 'Unknown'} ${data.before ?? '?'}->${data.after ?? '?'}`;
    case CombatEventType.ActionHit:
      if (data.actionId) return `ActionHit ${data.actionId} damage=${data.damage ?? 0}`;
      if (data.artId) return `ActionHit ${data.artId} damage=${data.damage ?? 0}${data.canceled ? ' [bonus]' : ''}`;
      return `ActionHit damage=${data.damage ?? 0}`;
    case CombatEventType.ActionWhiffed:
      return `ActionWhiffed ${data.actionId ?? data.artId ?? 'Unknown'}`;
    case CombatEventType.ActionFinished:
      return `ActionFinished ${data.actionId ?? data.artId ?? 'Unknown'}`;
    case CombatEventType.ArtChargeChanged:
      return `ArtChargeChanged ${data.artId ?? 'Unknown'} ${data.before ?? 0}->${data.after ?? 0}`;
    case CombatEventType.ArtBecameReady:
      return `ArtBecameReady ${data.artId ?? 'Unknown'}`;
    case CombatEventType.ArtConsumed:
      return `ArtConsumed ${data.artId ?? 'Unknown'}`;
    case CombatEventType.SpecialChargeChanged: {
      const beforeCharge = data.beforeCharge ?? 0;
      const afterCharge = data.afterCharge ?? 0;
      const beforeLv = data.beforeReadyLevel ?? 0;
      const afterLv = data.afterReadyLevel ?? 0;
      const src = data.artId ? ` from=${data.artId}` : '';
      return `SpecialChargeChanged ${beforeCharge}->${afterCharge} L${beforeLv}->L${afterLv}${src}`;
    }
    case CombatEventType.SpecialBecameReady:
      return `SpecialBecameReady L${data.readyLevel ?? 0} charge=${data.charge ?? 0}`;
    case CombatEventType.SpecialConsumed:
      return `SpecialConsumed ${data.specialId ?? 'Unknown'} L${data.level ?? 0} cost=${data.cost ?? 0} ${data.beforeCharge ?? 0}->${data.afterCharge ?? 0}`;
    case CombatEventType.SpecialCastFailed:
      return `SpecialCastFailed ${data.specialId ?? 'Unknown'} reason=${data.reason ?? '?'}`;
    case CombatEventType.SpecialHit:
      return `SpecialHit ${data.specialId ?? 'Unknown'} element=${data.element ?? '?'} L${data.level ?? 0} damage=${data.damage ?? 0}`;
    case CombatEventType.CancelBonusWindowOpened:
      return `CancelBonusWindowOpened ${data.frames ?? 0}f`;
    case CombatEventType.CancelBonusApplied:
      return `CancelBonusApplied ${data.artId ?? 'Unknown'}`;
    case CombatEventType.RecoveryCanceledToMovement:
      return `RecoveryCanceledToMovement ${data.actionId ?? 'Unknown'}`;
    case CombatEventType.RecoveryCanceledToArt:
      return `RecoveryCanceledToArt ${data.fromActionId ?? 'Unknown'} -> ${data.artId ?? 'Unknown'}`;
    case CombatEventType.AutoAttackChainAdvanced:
      return `AutoAttackChainAdvanced -> ${data.nextActionId ?? 'Unknown'}`;
    case CombatEventType.AutoAttackChainReset:
      return 'AutoAttackChainReset';
    case CombatEventType.DriverComboApplied:
      return `DriverComboApplied ${data.stage ?? 'None'} ${data.framesLeft ?? 0}f`;
    case CombatEventType.DriverComboAdvanced:
      return `DriverComboAdvanced ${data.fromStage ?? 'None'}->${data.toStage ?? 'None'} ${data.framesLeft ?? 0}f`;
    case CombatEventType.DriverComboRefreshed:
      return `DriverComboRefreshed ${data.stage ?? 'None'} ${data.beforeFramesLeft ?? 0}f->${data.framesLeft ?? 0}f`;
    case CombatEventType.DriverComboFailed:
      return `DriverComboFailed stage=${data.stage ?? 'None'} effect=${data.effect ?? '?'} requires=${data.requires ?? '?'}`;
    case CombatEventType.DriverComboExpired:
      return `DriverComboExpired ${data.stage ?? 'None'}`;
    case CombatEventType.DriverComboFinished:
      return `DriverComboFinished ${data.effect ?? 'Smash'}`;
    case CombatEventType.BladeComboStarted:
      return `BladeComboStarted route=${data.routeId ?? '?'} ${data.stage ?? 'None'} element=${data.element ?? '?'} next=${data.expectedNextElement ?? '?'} minL=${data.expectedNextMinLevel ?? 0} ${data.framesLeft ?? 0}f`;
    case CombatEventType.BladeComboAdvanced:
      return `BladeComboAdvanced route=${data.routeId ?? '?'} ${data.fromStage ?? 'None'}->${data.toStage ?? 'None'} element=${data.element ?? '?'} next=${data.expectedNextElement ?? '?'} minL=${data.expectedNextMinLevel ?? 0} ${data.framesLeft ?? 0}f`;
    case CombatEventType.BladeComboFailed:
      return `BladeComboFailed stage=${data.stage ?? 'None'} element=${data.element ?? '?'} requires=${data.requiresElement ?? '?'} minL=${data.requiresMinLevel ?? 0} reason=${data.reason ?? '?'}`;
    case CombatEventType.BladeComboExpired:
      return `BladeComboExpired ${data.stage ?? 'None'} reason=${data.reason ?? '?'}`;
    case CombatEventType.BladeComboFinished:
      return `BladeComboFinished route=${data.routeId ?? '?'} element=${data.element ?? '?'}`;
    case CombatEventType.TokenCreated:
      return `TokenCreated ${data.id ?? '?'} element=${data.element ?? '?'} route=${data.sourceRouteId ?? '?'}`;
    default:
      return String(type);
  }
}

export function emitCombatEvent(eventLog, frame, type, data = {}) {
  return eventLog.push(frame, type, formatCombatEvent(type, data), data);
}

