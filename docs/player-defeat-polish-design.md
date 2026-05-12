# Player Defeat Polish Design（玩家失败体验打磨设计）

> 本文是 V4.3 Player Defeat / Battle Failure Polish（玩家失败与战斗失败打磨）的设计文档。V4.3 的目标不是扩大战斗玩法，而是把 V4.2 已经实现的 `BattleEnded Defeat（战斗失败）` 从"事件结果"打磨成完整、可观察、可测试、可复位的失败体验。

**状态：已实现（V4.3 completed）**

## 1. 背景

V4.2 已实现 Enemy Attack MVP（敌人攻击最小实现）：

```text
EnemyAttackHit（敌人攻击命中）
  ↓
PlayerDamageApplied（玩家受到伤害）
  ↓
PlayerHpChanged（玩家生命变化）
  ↓
PlayerDefeated（玩家被击败）
  ↓
BattleEnded Defeat（战斗失败）
```

当前失败链路已经存在，但还只是 MVP（最小可玩版本）级别。V4.3 要做的是让失败状态更稳定、更容易理解、更不容易产生残留行为。

## 2. 设计目标

V4.3 的核心目标：

```text
玩家死亡后
  ↓
所有战斗规则停止
  ↓
UI / Canvas 明确显示 Defeat（失败）
  ↓
输入不会继续触发攻击
  ↓
敌人不会继续攻击
  ↓
Reset 能稳定恢复到可重新战斗状态
  ↓
Scenario proof（脚本化证明链）可证明全过程
```

V4.3 是 polish（打磨）阶段，不是新玩法阶段。

## 3. 必须保护的不变量

### 3.1 战斗结束后不能继续推进战斗规则

当：

```text
battle.active === false
```

必须停止：

- Player action（玩家动作）推进。
- Enemy action（敌人动作）推进。
- AutoAttack（自动普攻）启动。
- Art（武技）输入消费。
- EnemyAttack（敌人攻击）启动。
- Debuff tick（负面状态跳伤）继续造成新伤害。

允许继续：

- VFX（视觉提示）计时衰减。
- UI render（界面渲染）。
- Reset（重置）。

### 3.2 失败状态必须可读

Snapshot（状态快照）中必须能明确读到：

```js
battle: {
  active: false,
  result: 'Defeat'
}

player: {
  hp: 0,
  dead: true
}
```

Canvas（画布）和 DebugPanel（调试面板）不能只靠事件文本猜测失败状态。

### 3.3 Reset 必须清理失败状态

Reset（重置）之后必须恢复：

```text
battle.active = true
battle.result = null
player.hp = player.maxHp
player.dead = false
target.hp = target.maxHp
target.dead = false
enemy.state = Idle
enemy.action = null
enemy.cooldownLeft = initialCooldownLeft
```

并且可重新进入战斗。

## 4. UI / Canvas 目标

### 4.1 DebugPanel（调试面板）

Enemy / Player 区块需要清楚显示：

- Battle Result（战斗结果）：active / Defeat / Victory。
- Player HP（玩家生命值）：0/max + DEAD。
- Enemy State（敌人状态）：战斗结束后不应继续显示 Attacking（攻击中）。
- Last Enemy Event（最近敌人事件）：可看到 PlayerDefeated（玩家被击败）或 BattleEnded Defeat（战斗失败）。

### 4.2 Canvas（画布）

失败后需要显示：

```text
DEFEAT
```

并且玩家血条显示为 0。

可选但推荐：

```text
Press R to Reset
```

### 4.3 Scenario UI（场景按钮）

`Run Player Defeat` 后应保持 paused（暂停），方便观察最终状态：

```text
Defeat
Player HP 0
Enemy action stopped
```

## 5. Scenario（脚本化场景）设计

V4.3 应新增或补强这些场景：

### player-defeat-stops-combat

证明：

```text
EnemyAttackHit
  ↓
PlayerDefeated
  ↓
BattleEnded Defeat
  ↓
继续 tick 若干帧
  ↓
没有新的 EnemyAttackStarted / EnemyAttackHit / PlayerDamageApplied
```

### reset-after-defeat

证明：

```text
先进入 Defeat
  ↓
调用 resetRuntime
  ↓
battle.active === true
battle.result === null
player.dead === false
player.hp === player.maxHp
enemy.action === null
```

### input-ignored-after-defeat

证明：

```text
进入 Defeat
  ↓
继续输入 Art / movement
  ↓
不会 ActionStarted
不会 InputConsumed
不会 EnemyAttackStarted
```

## 6. Test（测试）设计

建议新增：

```text
tests/player-defeat-polish.test.mjs
```

覆盖：

- Defeat 后战斗规则停止。
- Defeat 后敌人不会继续攻击。
- Defeat 后玩家输入不会启动新动作。
- Reset 后可恢复到正常可战斗状态。
- finalSnapshot（最终状态快照）保留真实 Defeat 状态。

## 7. 事件要求

V4.3 不一定需要新增事件。

优先复用：

```text
PlayerDefeated（玩家被击败）
BattleEnded（战斗结束）
Reset（重置）
```

如果要新增，也只允许新增很小的可观察事件，例如：

```text
BattleInputIgnored（战斗结束后输入被忽略）
```

但建议第一版不新增，先用测试保证行为。

## 8. 不做内容

V4.3 禁止实现：

- 复活系统。
- 失败菜单。
- 存档/读档。
- 多人失败判定。
- 队友救援。
- Game Over UI 大界面。
- Chain Attack（连锁攻击阶段）。
- Full Burst（最终爆发）。
- Fusion Combo（融合连击）。

## 9. 与 V4.2.1 的关系

若 PR #14（V4.2.1 Enemy Combat Polish）已经合并，则 V4.3 必须继承：

- `lastEnemyOutcome` 结构化字段。
- Canvas 不再解析 `eventLogText` 判断 HIT/MISS。
- `finalSnapshot` 保留 scenario 真实终态。
- `battle.active === false` 时清理 stale action。

如果 PR #14 未合并，V4.3 实现前必须先合并或手动吸收这些修复。
