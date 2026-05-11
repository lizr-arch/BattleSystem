# NPC AI Design（敌人 AI 设计）

> 本文是 V4.1 Enemy Attack Model Design（敌人攻击模型设计）的一部分。本阶段只设计 Simple Enemy AI（简单敌人 AI），不实现复杂行为树。

## 1. AI 目标

第一版敌人 AI（敌人自动战斗逻辑）只做最小闭环：

```text
如果玩家活着
  ↓
如果玩家在攻击范围内
  ↓
如果冷却结束
  ↓
发动 EnemyStrike（敌人普通攻击）
```

如果玩家不在范围内，V4.2 建议先不追击，只等待并保持可观察状态。移动追击留到后续版本。

## 2. EnemyAIState（敌人 AI 状态）

状态草案：

```text
Idle（待机）
Attacking（攻击中）
Cooldown（冷却中）
Controlled（被控制）
Dead（死亡）
```

状态转换：

```text
Idle -> Attacking
Attacking -> Cooldown
Cooldown -> Idle
Any -> Controlled
Any -> Dead
```

## 3. Target Selection（目标选择）

V4.2 第一版只有一个玩家，因此：

```text
targetId = Player
```

但设计上要保留 Aggro（仇恨）扩展口径。

未来 Party Battle（队伍战斗）中，敌人应通过 AggroTable（仇恨表）选择目标：

```text
造成伤害越高 -> 仇恨越高
治疗/支援 -> 可产生仇恨
坦克技能 -> 主动提高仇恨
```

V4.1 只记录这个方向，不实现。

## 4. AI Tick（AI 每帧更新）草案

V4.2 的每帧逻辑建议：

```text
if enemy.dead:
  state = Dead
  return

if player.dead:
  return

if enemy is controlled by Topple / Launch:
  state = Controlled
  cancel current attack if needed
  return

if currentAction exists:
  tick currentAction
  return

if cooldownLeft > 0:
  cooldownLeft -= 1
  state = Cooldown
  return

if distance(enemy, player) <= EnemyStrike.range:
  start EnemyStrike
else:
  state = Idle
```

第一版不追击，避免引入移动/寻路复杂度。

## 5. Control Interaction（控制交互）

Driver Combo（驱动者连击）会影响敌人 AI。

建议 V4.2 规则：

- Break（破防）：不阻止攻击。
- Topple（倒地）：敌人不能攻击；如果正在攻击，取消当前攻击。
- Launch（浮空）：敌人不能攻击；如果正在攻击，取消当前攻击。
- Smash（猛击）：瞬时结算，不作为持续 AI 状态。

Cooldown（冷却）第一版可以继续减少，保持简单。

## 6. 测试计划

V4.2 应新增：

```text
tests/enemy-attack.test.mjs
tests/enemy-attack-scenario.test.mjs
tests/player-defeat.test.mjs
```

测试场景：

- enemy-starts-attack-when-player-in-range（玩家在范围内时敌人开始攻击）
- enemy-attack-hits-player（敌人攻击命中玩家）
- enemy-attack-whiffs-when-player-out-of-range（玩家不在范围内时敌人攻击打空）
- enemy-attack-enters-cooldown（敌人攻击后进入冷却）
- enemy-cannot-attack-while-toppled（敌人倒地时不能攻击）
- enemy-can-defeat-player（敌人可以击败玩家）
- player-can-defeat-attacking-enemy（玩家可以击败正在攻击的敌人）

## 7. UI / Canvas（界面 / 画布）计划

未来 DebugPanel（调试面板）显示：

```text
Enemy State（敌人状态）
Enemy Action（敌人动作）
Enemy Phase（敌人阶段）
Enemy Cooldown（敌人冷却）
Player HP（玩家生命值）
Last Enemy Event（最近敌人事件）
```

Canvas（画布）显示：

```text
ENEMY WINDUP（敌人前摇）
HIT（命中）
MISS（打空）
PLAYER LOW HP（玩家低血量）
DEFEAT（失败）
```

## 8. 不做内容

V4.1 / V4.2 不做：

- 行为树。
- 寻路。
- 多敌人。
- 队友 AI。
- 完整 Aggro（仇恨）系统。
- 治疗、坦克、队伍职责。
- Chain Attack（连锁攻击阶段）。
- Full Burst（最终爆发）。
- Fusion Combo（融合连击）。
