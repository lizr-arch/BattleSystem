# Enemy Attack Model（敌人攻击模型）

> 本文件起源于 V4.1 的敌人攻击模型设计；V4.2 已落地最小实现（EnemyStrike）。本文以实现口径为准，并保留设计意图作为后续扩展参考。

实现入口（V4.2）：

- `src/core/enemy-strike.js`（EnemyStrikeSpec / EnemyRuntimeState）
- `src/core/combat-actor.js`（tickEnemy、命中/打空、玩家扣血与 Defeat）
- `src/ui/debug-panel.js`（Enemy/Player 面板与场景按钮）

## 1. 设计目标

V4.0 已经让 Single Driver（单人驱动者）可以对 Dummy（木桩目标）完成攻击、套路挂球、削球、Burn（燃烧）、击杀、Victory（胜利）。

V4.1 要把下一步“敌人如何攻击玩家”设计清楚，让系统从：

```text
玩家打木桩
```

升级为：

```text
玩家与敌人互相战斗
```

第一版敌人不需要复杂战术，只需要具备一个可测试、可观察、可复用的攻击模型。

## 2. Enemy Runtime State（敌人运行时状态）

V4.2 的最小实现把“敌人血量/位置”与“敌人 AI/攻击状态”拆开：

- `CombatActor.target`：承载敌人位置与 HP（用于 Victory 结算与玩家输出目标）。
- `CombatActor.enemy`：承载 enemy runtime state（AI 状态、冷却、当前攻击 action）。

对应快照会合并为 `snapshot.enemy`（用于 UI 与 scenario runner 只读展示）。

最小结构（以 snapshot 口径描述）：

```js
enemy: {
  id: 'Enemy',
  position: { x, y },
  hp: number,
  maxHp: number,
  dead: boolean,
  targetId: 'Player',
  state: 'Idle' | 'Attacking' | 'Cooldown' | 'Controlled' | 'Dead',
  currentAction: null,
  cooldownLeft: 0
}
```

字段说明：

- `state`（状态）：敌人当前行为。
- `targetId`（目标 ID）：第一版固定为 Player（玩家）。
- `currentAction`（当前动作）：敌人的攻击动作实例。
- `cooldownLeft`（冷却剩余帧）：控制攻击频率。

## 3. EnemyAttackSpec（敌人攻击配置）

第一版只需要一个攻击：EnemyStrike（敌人普通攻击）。

```js
EnemyAttackSpec {
  id: 'EnemyStrike',
  startupFrames: 30,
  activeFrames: 4,
  recoveryFrames: 30,
  cooldownFrames: 90,
  damage: 15,
  range: 140
}
```

字段说明：

- `startupFrames`（前摇帧数）：敌人准备攻击的时间，可用于 Canvas（画布）显示危险预警。
- `activeFrames`（命中段帧数）：真正检查命中并造成伤害的阶段。
- `recoveryFrames`（后摇帧数）：攻击结束后的恢复期。
- `cooldownFrames`（冷却帧数）：下一次攻击前的等待时间。
- `damage`（伤害）：命中玩家时扣除 HP（生命值）。
- `range`（攻击距离）：玩家在这个距离内才可能被命中。

## 4. Enemy Action Timeline（敌人动作时间轴）

敌人攻击也应使用动作阶段：

```text
Startup（前摇） -> Active（命中段） -> Recovery（后摇） -> Finished（结束）
```

理由：

- 可测试：可以断言第几帧进入 Active（命中段）。
- 可视化：可以显示 ENEMY WINDUP（敌人前摇）和 HIT（命中）。
- 可扩展：后续敌人技能能复用同一模型。
- 可解释：阶段变化都能通过事件日志复盘。

冷却（Cooldown）在当前实现中不作为 action phase，而是通过 `enemy.cooldownLeft` 与 `enemy.state=Cooldown` 独立表达，并在 `cooldownLeft` 递减到 0 时发出对应事件。

## 5. 命中判定

V4.2 的最小命中判定只做距离：

```text
if distance(enemy, player) <= attack.range:
  EnemyAttackHit（敌人攻击命中）
else:
  EnemyAttackWhiffed（敌人攻击打空）
```

不做方向扇形、碰撞盒、闪避、格挡、路径障碍。

## 6. Player Damage（玩家受伤）

敌人命中玩家后，应该走玩家受伤链路：

```text
EnemyAttackHit（敌人攻击命中）
  ↓
PlayerDamageApplied（玩家受到伤害）
  ↓
PlayerHpChanged（玩家生命变化）
  ↓
PlayerDefeated（玩家被击败）
  ↓
BattleEnded Defeat（战斗结束：失败）
```

V4.2 可以先实现玩家专用方法：

```js
applyDamageToPlayer(amount, { source, sourceId })
```

未来再统一为：

```js
applyDamage(targetRef, amount, source)
```

## 7. Driver Combo（驱动者连击）对敌人攻击的影响

建议第一版：

| DriverCombo Stage（驱动者连击阶段） | 对敌人攻击的影响 |
| --- | --- |
| None（无） | 正常攻击 |
| Break（破防） | 不阻止攻击 |
| Topple（倒地） | 暂停或取消敌人当前攻击 |
| Launch（浮空） | 暂停或取消敌人当前攻击 |
| Smash（猛击） | 瞬时结算，不作为持续控制 |

如果敌人在 Startup（前摇）或 Active（命中段）时被 Topple（倒地）/ Launch（浮空），V4.2 可取消当前攻击并进入 Controlled（被控制）。

## 8. 事件草案

V4.2 已加入 CombatEventType（战斗事件枚举），以实现字段为准：

- EnemyTargetSelected（敌人选择目标）：`enemyId`、`targetId`
- EnemyMoveStarted（敌人开始移动）：V4.2 可暂不实现
- EnemyMoveStopped（敌人停止移动）：V4.2 可暂不实现
- EnemyAttackStarted（敌人攻击开始）：`enemyId`、`attackId`、`targetId`
- EnemyAttackPhaseChanged（敌人攻击阶段变化）：`attackId`、`before`、`after`、`enemyId`
- EnemyAttackHit（敌人攻击命中）：`enemyId`、`attackId`、`targetId`、`damage`
- EnemyAttackWhiffed（敌人攻击打空）：`enemyId`、`attackId`、`reason`
- EnemyAttackFinished（敌人攻击结束）：`enemyId`、`attackId`
- EnemyAttackCooldownStarted（敌人攻击冷却开始）：`enemyId`、`attackId`、`frames`
- EnemyAttackCooldownFinished（敌人攻击冷却结束）：`enemyId`、`attackId`
- EnemyControlled（敌人被控制）：`enemyId`、`stage`、`framesLeft`
- EnemyStrikeInterrupted（敌人攻击被中断）：`enemyId`、`strikeId`、`reason`、`stage`
- PlayerDamageApplied（玩家受到伤害）：`amount`、`source`、`sourceId`、`beforeHp`、`afterHp`
- PlayerHpChanged（玩家生命变化）：`before`、`after`、`maxHp`
- PlayerDefeated（玩家被击败）：无（`{}`）

## 9. Snapshot（状态快照）

V4.2 已扩展 CombatActor.getSnapshot()：

```js
snapshot.enemy = {
  id,
  hp,
  maxHp,
  dead,
  state,
  position,
  targetId,
  currentAction,
  cooldownLeft
}

snapshot.player = {
  hp,
  maxHp,
  dead
}

snapshot.battle = {
  active,
  result
}
```

UI（界面层）和 Scenario Runner（脚本化场景运行器）必须读 Snapshot（状态快照）。

## 10. V4.2 最小实现建议

V4.2 应新增：

```text
src/core/enemy-strike.js
tests/enemy-attack.test.mjs
tests/enemy-attack-scenario.test.mjs
tests/enemy-strike-scenario.test.mjs
tests/player-defeat.test.mjs
```

EnemyActor（敌人角色）可以先作为 CombatActor（战斗角色）的 enemy 子对象实现，长期再拆独立模型。

最小验收：

- 敌人能开始攻击。
- 敌人攻击有 Startup（前摇）/ Active（命中段）/ Recovery（后摇）/ Finished（结束），并在结束后进入 Cooldown（冷却）。
- 玩家在范围内会受到伤害。
- 玩家不在范围内会 EnemyAttackWhiffed（敌人攻击打空）。
- 玩家 HP 到 0 会 PlayerDefeated（玩家被击败）和 BattleEnded Defeat（失败）。
