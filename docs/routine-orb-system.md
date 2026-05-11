# Routine Orb System（例行球系统，V4.0 MVP）

本文件描述 V4.0 “Single Driver Routine-Orb MVP（单驾驶员·例行球最小可玩闭环）”的机制范围、术语与可观察性验收口径。实现与测试为准：`src/core/*` + `tests/*` + Debug 面板的一键 Run。

## 术语（中英对照）

| 英文 | 中文建议 | 含义 |
| --- | --- | --- |
| Routine | 例行（套路） | 一条“技能路线/套路”的标识（当前只有 FireRoutine） |
| Routine Skill | 例行技能 | Routine 里的具体技能（当前映射到 Art1/2/3） |
| Tile | 例行牌（瓦片） | 例行技能命中后生成的记录项（最多 3 张） |
| Orb | 例行球 | 当最近 3 张例行牌同一 Routine 时生成的球（仅一个 active） |
| Orb Break | 破球 | 对当前 active orb 执行的结算（元素伤害 + Debuff） |
| Debuff | 负面效果 | 目前只实现 Burn（灼烧） |
| Single Driver | 单驾驶员 | 仅验证单个玩家 actor 的闭环，不引入队友/敌人 AI |

## MVP 目标与非目标

目标（做什么）：

- 建立“命中 → 生成 tiles → 生成 orb → 破球 → DoT tick → 击杀 → 战斗结束”的确定性事件链路。
- 以事件日志 + 快照（snapshot）作为主验收证据，避免黑盒规则。
- 提供 Node tests + scenarios + Browser Debug 面板一键验证入口。

非目标（明确不做）：

- 不实现 Chain Attack（连锁攻击）、Full Burst、Fusion、复杂 Orbs 系统与其 cash-out。
- 不实现多 Routine、多元素、多 orb 共存、orb stacking/计数规则、队友/敌人 AI。
- 不把 Routine Skill 的 trait（SkillTrait）真正接入结算（当前仅作为“模型接口预留”）。

## 核心闭环（事件链路视角）

```text
Reset + BattleStarted
  ↓
Art1/2/3 命中（ActionHit + DamageApplied + TargetHpChanged）
  ↓
RoutineTileAdded（最多 3 张；超出则 RoutineTileRemoved）
  ↓
最近 3 张同 Routine => RoutineOrbCreated（已有 orb 则 RoutineOrbReplaced）
  ↓
breakRoutineOrb()
  ↓
RoutineOrbBreakStarted
  ↓
ElementDamageApplied + DamageApplied + TargetHpChanged
  ↓
DebuffApplied(Burn)
  ↓
RoutineOrbBroken + RoutineOrbBreakFinished（并清空 tiles/orb）
  ↓
每 60f：DebuffTickDamage + DamageApplied + TargetHpChanged
  ↓
TargetDefeated + BattleEnded(Victory)
```

## 数据模型（以 snapshot 为准）

### Battle / Target HP

- `snapshot.battle = { active: boolean, result: null | 'Victory' }`
- `snapshot.target = { id, hp, maxHp, dead, x, y, radius }`

HP 只通过统一的扣血通路改变，并以事件可观察（见 `DamageApplied/TargetHpChanged`）。

### Routine Tiles（例行牌）

当 Art 命中且能映射到 Routine Skill 时生成一张 tile：

```js
{ routineId, skillId, layer, createdFrame }
```

规则：

- 最多保留 3 张；超过时移除最旧的一张（必须产出 `RoutineTileRemoved`）。
- 当前 Routine Skill 仅由 ArtId 映射：`Art1/Art2/Art3 -> FireSkill1/2/3`。

### Routine Orb（例行球）

当最近 3 张 tile 都属于同一 `routineId` 时创建 orb：

```js
{ routineId, totalLayer, createdFrame }
```

规则：

- `totalLayer = layer 之和`（例如 1+2+3=6）。
- 同时只允许存在 1 个 active orb；再次满足创建条件时会替换（`RoutineOrbReplaced`）。

### Debuffs（负面效果）

破球会施加 Burn（灼烧）：

- 持续：300f
- tick：每 60f
- tick 伤害：5

## 关键 API 入口

- `actor.breakRoutineOrb()`：触发破球结算；无 orb 必须失败并产出原因（`RoutineOrbBreakFailed reason=no_orb`）。

## 可观察性与验收入口

Node（确定性）：

- `npm test` 覆盖：
  - `tests/routine-orb.test.mjs`
  - `tests/routine-orb-scenario.test.mjs`
  - `tests/single-driver-mvp.test.mjs`

Browser（可视化）：

- Debug 面板 “Single Driver MVP” 区块展示：
  - Target HP bar / tiles / orb / burn / 最后一条 MVP 相关事件
- Scenario 区块提供一键 Run：
  - `single-driver-routine-orb-victory`（完整闭环 proof）
  - 以及 create/break/without-orb/burn-kill 等分场景

