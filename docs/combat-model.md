# 战斗模型

## 实现位置（V1-V4.2）

- 规则实现：`src/core/*`（纯逻辑，不依赖 DOM / Canvas）
- 默认数值：`src/data/default-combat-config.js`
- 浏览器沙盒：`src/ui/*` + 根目录 `index.html`

## 基础闭环（V1）

```text
玩家站定
  ↓
自动普攻开始
  ↓
Startup 前摇
  ↓
Active 命中
  ↓
武技充能
  ↓
Recovery 后摇
  ↓
移动取消 / 武技取消
```

## 普攻定位

当前设计里，普攻不是主要操作输出，而是资源生产器。

普攻命中会：

1. 造成基础伤害。
2. 给武技增加 charge。
3. 打开 Cancel Bonus 窗口。
4. 推动普攻链节奏。

## 移动含义

移动不是传统 ARPG 的自由走砍，而是资源生产条件。

| 场景 | 结果 |
| --- | --- |
| 未行动时移动 | 阻止普攻启动 |
| 普攻 Startup 中移动 | 不打断已经承诺的攻击 |
| 普攻 Recovery 中移动 | 取消后摇，进入移动，并重置普攻链 |

## 武技含义

武技是资源消费：

- 普攻命中使武技充能。
- 武技 Ready 后可以被输入消费。
- 在普攻后摇中使用 Ready 武技，可以跳过普攻后摇。
- 如果仍处于 Cancel Bonus 窗口，则获得奖励。

## Driver Combo（V2）

Driver Combo 是“控制链”层，不改变 V1 的普攻/充能/取消闭环，而是挂在“武技命中”的效果处理之后，用来验证状态推进、持续时间、失败分支是否可解释。

### 状态模型

```text
stage: None / Break / Topple / Launch
framesLeft: 当前阶段剩余帧数（倒计时）
```

- stage 初始为 `None`。
- `Break/Topple/Launch` 有各自持续时间；倒计时归零会过期回到 `None`。
- `Smash` 不是一个持续 stage，而是“完成效果”：触发后立刻结束并回到 `None`。

### 推进规则

推进仅发生在 Art 命中时（whiff 不推进），并按 effect 顺序要求：

```text
None   + Break  => Applied(Break)
Break  + Topple => Advanced(Break->Topple)
Topple + Launch => Advanced(Topple->Launch)
Launch + Smash  => Finished(Smash) 并回到 None
```

额外规则：

- `Break` 阶段再次命中 `Break` 会刷新持续时间（用于容错验证）。
- 错序 effect 会产出 `DriverComboFailed`，且不推进 stage（通过日志可证明）。

### 默认持续时间（60 FPS）

| 阶段 | 持续（帧） | 约等于（秒） |
| --- | ---: | ---: |
| Break | 180f | 3.0s |
| Topple | 150f | 2.5s |
| Launch | 120f | 2.0s |

## Special Gauge（V3）

Special Gauge 是一条“可充能、可 ready、可消费”的资源条，用于驱动 Specials。

### 状态模型

```text
charge: 0..300
readyLevel: 0..3（按阈值 100/200/300 计算）
```

### 充能与消费规则

- 充能入口：当前实现为 “Art 命中” 后按 `art.specialChargeGain` 增加（whiff 不充能）。
- 只有当 `readyLevel >= special.level` 时，才允许消费并释放该 Special。
- 消耗规则：消费等级 L1/L2/L3 的 cost 为 100/200/300（= level * 100）。

## Blade Combo（V3）

Blade Combo 是一条“元素路线链”，由 Specials 命中推进；完成后产出 Token（延迟奖励输入）。

### 状态模型

```text
stage: None / Stage1 / Stage2
framesLeft: 倒计时（归零过期回 None）
routeId: 当前路线（或 null）
stepIndex: 当前步索引（-1 表示无）
expectedNext: 下一步要求（element + minLevel）
```

### 推进规则（以默认路线为例）

```text
None   + Fire(L1)  => Started(Stage1)  next=Water(L2)
Stage1 + Water(L2) => Advanced(Stage2) next=Fire(L3)
Stage2 + Fire(L3)  => Finished + TokenCreated(FireToken) 并回到 None
```

- Specials whiff 不推进（由 Special 命中结算触发推进）。
- 错元素 / 等级不足会产出 Failed 事件，且不推进当前阶段。
- 倒计时归零会产出 Expired，且回到 None。

## Token（V3）

Token 是 Blade Combo 完成后的产物，用于“延迟奖励输入”的可观察性验证。

- 当前实现只包含创建与快照可读（`tokens[]` + `TokenCreated`）。
- 明确不包含：兑现/破碎/消费（例如 Chain Attack 或其它 cash-out 机制）。

## Battle / HP / Result（V4.0-V4.2）

V4.0 引入“可击杀目标 + 战斗结果”作为单驾驶员 MVP 的最小闭环地基。

### 状态模型

```text
battle: { active: boolean, result: null | 'Victory' | 'Defeat' }
target: { id, hp, maxHp?, dead, ... }   # 当前用作“敌人血条/胜利判定目标”
player: { hp, maxHp, dead }            # V4.2 起加入“可失败”
```

### 规则

- 所有扣血必须走统一通路，并可被事件审计：
  - `DamageApplied`（记录来源与本次实际扣血）
  - `TargetHpChanged`（记录 before/after/maxHp）
- 当 `target.hp` 归零时：
  - 产出 `TargetDefeated`
  - 战斗结束：`battle.active=false`，`battle.result='Victory'`，并产出 `BattleEnded`
- 当 `player.hp` 归零时：
  - 产出 `PlayerDefeated`
  - 战斗结束：`battle.active=false`，`battle.result='Defeat'`，并产出 `BattleEnded`

## Routine Orb（套路球，V4.0）

Routine Orb 系统是 V4.0 的“最小属性球闭环”：用最少规则验证“命中记录 → 球生成 → 破球结算 → DoT 击杀”的可观察链路。

### 概念

- Routine（套路）：一条技能路线标识（当前仅 `FireRoutine`）。
- Tile（套路牌）：套路技能命中后生成的记录项（最多 3 张）。
- Orb（套路球）：最近 3 张 tile 都属于同一 routine 时自动生成（仅 1 个 active）。
- Orb Break（破球）：对 active orb 执行一次性结算（元素伤害 + Debuff），并清空 orb 与 tiles。

### 推进规则（概览）

```text
Art hit (mapped to RoutineSkill)
  => RoutineTileAdded (cap=3, oldest removed)
  => if last 3 tiles same routine => RoutineOrbCreated / RoutineOrbReplaced

breakRoutineOrb()
  => RoutineOrbBreakStarted
  => ElementDamageApplied + DamageApplied + TargetHpChanged
  => DebuffApplied(Burn)
  => RoutineOrbBroken + RoutineOrbBreakFinished
  => clear routineOrb + routineTiles
```

### Burn（灼烧）

- 破球会施加 Burn（300f，60f tick，5 damage/tick）。
- 每次 tick 必须产出 `DebuffTickDamage`，并通过 `DamageApplied` 扣血；若击杀目标，必须触发 `TargetDefeated` 与 `BattleEnded Victory`。

## EnemyStrike（敌人普通攻击，V4.2）

V4.2 把“木桩目标”升级为“可主动攻击玩家的简单敌人”：

- 敌人攻击按动作阶段运行：`Startup -> Active -> Recovery -> Finished`（沿用同一时间轴模型）。
- 命中判定最小化：仅距离（`distance(player, target) <= range`）。
- 控制门禁：Driver Combo 处于 `Topple/Launch` 时，敌人不能攻击；若正在攻击则中断并进入冷却。

## 默认参数

| 动作 | Startup | Active | Recovery | Damage | Art Charge Gain | Special Gain | Effect |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| AA1 | 18f | 2f | 24f | 10 | +1 | 0 | - |
| AA2 | 22f | 2f | 28f | 14 | +1 | 0 | - |
| AA3 | 30f | 2f | 36f | 24 | +2 | 0 | - |
| Art1 | 15f | 4f | 28f | 40 | 0 | +25 | Break |
| Art2 | 15f | 4f | 28f | 50 | 0 | +25 | Topple |
| Art3 | 15f | 4f | 28f | 60 | 0 | +30 | Launch |
| Art4 | 15f | 4f | 28f | 80 | 0 | +40 | Smash |

| Enemy | Startup | Active | Recovery | Damage | Range | Cooldown |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| EnemyStrike | 30f | 4f | 30f | 15 | 140 | 90f |

| Special | Startup | Active | Recovery | Damage | Level | Element |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| FireLv1 | 20f | 4f | 36f | 120 | 1 | Fire |
| WaterLv2 | 22f | 4f | 38f | 180 | 2 | Water |
| FireLv3 | 24f | 5f | 40f | 240 | 3 | Fire |

| 参数 | 默认值 |
| --- | ---: |
| 逻辑帧率 | 60 FPS |
| Input Buffer | 10f |
| Cancel Bonus | 15f |
| Art1 Max Charge | 2 |
| Art2 Max Charge | 3 |
| Art3 Max Charge | 4 |
| Art4 Max Charge | 4 |
| Special Gauge | 0..300（阈值 100/200/300） |
| Blade Combo Route | FireWaterFire（240f） |

## 当前暂不实现（<= V4.3）

当前阶段暂不实现（当前版本边界：<= V4.3；如进入后续 V4.x，必须先完成 Readiness Review 与拆分计划，见 `docs/v4-readiness-review.md`）：

- 敌人复杂 AI（追击/寻路/行为树/多敌人/队友 AI/完整 Aggro 仇恨系统）。
- 仇恨系统。
- 复杂属性球系统（多球共存、堆叠/计数规则、与连锁兑现的整套 cash-out）。
- Chain Attack / Full Burst / Fusion（V4.0 延后；未来只允许按 V4 拆分评审进入）。
- Token cash-out（只验证 token 产出，不消费/兑现）。
- Routine Skill trait 参与结算（当前 trait 模型仅预留接口，不影响伤害结算）。

这些后续都可以挂在当前 `ActionHit` / `DriverCombo*` 等事件链路之后。
