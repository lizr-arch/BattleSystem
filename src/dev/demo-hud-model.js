export function createDemoHudModel(snapshot, options = {}) {
  const activeBlades = snapshot?.resolvedLoadout?.activeBlades ?? [];
  const bladeIds = activeBlades.map((b) => b?.bladeId ?? '');
  const isDemo = options.isDemo !== undefined
    ? Boolean(options.isDemo)
    : (bladeIds.includes('GreyWolfBlade') && bladeIds.includes('BrownBearBlade'));

  const playerHp = snapshot?.player?.hp ?? 0;
  const playerMaxHp = snapshot?.player?.maxHp ?? 0;
  const playerDead = snapshot?.player?.dead === true;
  const player = {
    hp: playerHp,
    maxHp: playerMaxHp,
    hpText: `${playerHp}/${playerMaxHp}`,
    hpRatio: playerMaxHp > 0 ? Math.max(0, Math.min(1, playerHp / playerMaxHp)) : 0,
    status: playerDead ? 'Dead' : 'Alive',
  };

  const targetId = snapshot?.target?.id ?? 'TrainingBrute';
  const targetHp = snapshot?.target?.hp ?? 0;
  const targetMaxHp = snapshot?.target?.maxHp ?? 0;
  const enemyState = snapshot?.enemy?.state ?? 'N/A';
  const enemy = {
    id: targetId,
    hp: targetHp,
    maxHp: targetMaxHp,
    hpText: `${targetHp}/${targetMaxHp}`,
    hpRatio: targetMaxHp > 0 ? Math.max(0, Math.min(1, targetHp / targetMaxHp)) : 0,
    state: enemyState,
  };

  const battleActive = snapshot?.battle?.active !== false;
  const battleResult = snapshot?.battle?.result ?? null;
  const battle = {
    active: battleActive,
    result: battleResult,
    stateText: battleResult === 'Victory' ? 'Victory'
      : battleResult === 'Defeat' ? 'Defeat'
      : battleActive ? 'Active'
      : 'Inactive',
    goalText: isDemo ? 'Defeat the Training Brute!' : 'No active goal',
  };

  const controls = [
    'WASD / Arrow: Move',
    '1-4: Arts',
    'R: Reset Demo',
    'Space: Pause',
  ];

  const bladeRuntimes = snapshot?.bladeRuntimes ?? [];
  const blades = bladeRuntimes.map((br) => {
    const unlocks = br?.unlocks?.combatSlots ?? [];
    return {
      bladeId: br?.bladeId ?? '-',
      species: br?.species ?? '-',
      lineage: br?.lineage ?? '-',
      element: br?.element ?? 'Neutral',
      trait: br?.individualTrait ?? '-',
      trustLevel: br?.bond?.trustLevel ?? 1,
      unlocksText: unlocks.length > 0 ? unlocks.join(', ') : '-',
    };
  });

  const eventLogText = typeof snapshot?.eventLogText === 'string' ? snapshot.eventLogText : '';
  const lines = eventLogText ? eventLogText.split('\n') : [];

  function findLastLine(accept) {
    for (const line of lines) {
      const trimmed = (line ?? '').trim();
      if (!trimmed) continue;
      const msg = trimmed.replace(/^F\d+\s+/, '');
      if (accept(msg)) return trimmed;
    }
    return null;
  }

  const payoffLine = findLastLine((msg) => msg.startsWith('TraitPayoffActivated'));
  const payoffText = payoffLine || '-';

  const importantPrefixes = [
    'BattleEnded',
    'PlayerDefeated',
    'TargetDefeated',
    'EnemyAttackHit',
    'EnemyAttackWhiffed',
    'DriverComboFinished',
    'BladeCombo',
    'TraitPayoffActivated',
  ];
  const importantLine = findLastLine((msg) => importantPrefixes.some((p) => msg.startsWith(p)));
  const importantEventText = importantLine || '-';

  let hintText = '';
  if (battleResult === 'Victory') {
    hintText = 'Press R to Reset';
  } else if (battleResult === 'Defeat') {
    hintText = 'Press R to Reset';
  } else if (battleActive && playerHp > 0 && targetHp > 0) {
    hintText = 'Move and use Arts to fight!';
  }

  const recent = {
    payoffText,
    importantEventText,
    hintText,
  };

  const actorState = snapshot?.state ?? 'None';
  const actionPhase = snapshot?.action?.phase ?? 'None';
  const diagEnemyState = snapshot?.enemy?.state ?? 'N/A';

  const inputBuffer = snapshot?.inputBuffer ?? {};
  const inputBufferActive = inputBuffer?.hasArt === true;
  const inputBufferRemaining = inputBufferActive ? Math.round((inputBuffer?.ratio ?? 0) * (inputBuffer?.maxFrames ?? 0)) : 0;
  const inputBufferTotal = inputBuffer?.maxFrames ?? 0;
  const inputBufferText = inputBufferActive
    ? `active (${inputBufferRemaining}/${inputBufferTotal})`
    : 'inactive';

  const cancelBonus = snapshot?.cancelBonus ?? {};
  const cancelWindowActive = (cancelBonus?.left ?? 0) > 0;
  const cancelWindowLeft = cancelBonus?.left ?? 0;
  const cancelWindowTotal = cancelBonus?.frames ?? 0;
  const cancelWindowText = cancelWindowActive
    ? `active (${cancelWindowLeft}/${cancelWindowTotal})`
    : 'inactive';

  const warnings = [];

  if (isDemo) {
    if (activeBlades.length < 2) {
      warnings.push('Demo expected at least 2 active blades.');
    }

    if (!targetId.includes('TrainingBrute')) {
      warnings.push('Demo expected TrainingBrute target.');
    }

    for (const br of bladeRuntimes) {
      const trustLevel = br?.bond?.trustLevel ?? 1;
      if (trustLevel >= 3) {
        const slots = br?.unlocks?.combatSlots ?? [];
        if (!slots.includes('BondCombatSlot1')) {
          warnings.push('Demo blade missing BondCombatSlot1.');
        }
      }
    }
  }

  if (playerHp <= 0 && battleResult !== 'Defeat') {
    warnings.push('Player HP is 0 but battle result is not Defeat.');
  }

  if (targetHp <= 0 && battleResult !== 'Victory') {
    warnings.push('Enemy HP is 0 but battle result is not Victory.');
  }

  if (!battleActive && !battleResult) {
    warnings.push('Battle inactive without result.');
  }

  const diagnostics = {
    actorState,
    actionPhase,
    enemyState: diagEnemyState,
    inputBufferText,
    cancelWindowText,
    warnings,
  };

  return {
    isDemo,
    player,
    enemy,
    battle,
    controls,
    blades,
    recent,
    diagnostics,
  };
}
