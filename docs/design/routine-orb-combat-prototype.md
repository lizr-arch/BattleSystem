# Routine-Orb Combat Prototype（套路挂球战斗设计原型）

> 本文是 BattleSystem 的策划案 / 设计原型，用于指导后续开发。它不是完整实现说明，而是后续 V4.0 Single Driver Routine-Orb Combat MVP（单人驱动者 + 套路挂球战斗最小可玩版本）的设计依据。

## 1. 核心定位

BattleSystem 的方向不是普通 ARPG（动作角色扮演），而是：

```text
XB2-like（异度之刃2风格）
  +
武侠套路（同一武功体系的技能组合）
  +
麻将式挂球/削球（像打牌一样组牌型并结算）
```

核心结论：

- Auto Attack（自动普攻）是资源生产器。
- Art（武技）是资源消费、状态推进和套路牌生成工具。
- 挂球不是 Buff（状态加成/负面状态），而是 Routine Tile（套路牌）组合成 Routine Orb（套路球）。
- 削球不是删除图标，而是按牌型结算，产生 Element Damage（套路属性伤害）和 Debuff（负面状态）。
- 单人 MVP（最小可玩版本）也必须能挂球，否则会退化成普通“打血条”战斗。

## 2. 麻将式挂球类比

| 麻将概念 | BattleSystem 概念 | 说明 |
| --- | --- | --- |
| 牌 | Routine Tile（套路牌） | 技能命中后放到敌人身上的组合材料 |
| 花色 / 牌系 | Routine（武功套路） | 技能所属的套路体系 |
| 牌点 | Layer（层数） | 单张套路牌的权重 |
| 手牌 / 牌池 | Routine Tile Pool（套路牌池） | 敌人身上最近若干张套路牌 |
| 牌型 | Routine Orb（套路球） | 多张套路牌形成的可结算组合 |
| 胡牌 / 拆牌 | Break Routine Orb（削球） | 结算套路球，造成伤害和负面效果 |
| 役种效果 | Debuff（负面状态） | 削球附加的燃烧、减伤、掉蓝、眩晕等效果 |

## 3. Skill Trait（技能特性）与 Routine（武功套路）必须分开

Skill Trait（技能特性）描述技能直接做什么：

```text
HpDamage（生命伤害）
MpDamage（蓝量伤害）
HpDot（持续生命伤害）
MpDot（持续蓝量伤害）
StunChance（概率眩晕）
DamageDown（降低伤害）
DefenseDown（降低防御）
SpeedDown（降低速度）
```

Routine（武功套路）描述技能属于哪一套组合体系。

示例：

```js
{
  id: 'FireSkill1',
  name: '烈火一式',
  routineId: 'FireRoutine',
  layer: 1,
  traits: [
    { type: 'HpDamage', value: 30 }
  ]
}
```

解释：

- `HpDamage（生命伤害）` 是技能直接效果。
- `FireRoutine（烈火套路）` 是挂球组合归属。
- `layer（层数）` 是套路牌强度。

## 4. MVP 默认套路：FireRoutine（烈火套路）

第一版只做一套套路：

```text
FireRoutine（烈火套路）
```

默认技能：

| 技能 | 套路 | 层数 | 直接效果 |
| --- | --- | ---: | --- |
| FireSkill1（烈火一式） | FireRoutine（烈火套路） | 1 | HpDamage 30 |
| FireSkill2（烈火二式） | FireRoutine（烈火套路） | 2 | HpDamage 40 |
| FireSkill3（烈火三式） | FireRoutine（烈火套路） | 3 | HpDamage 50 |

可以暂时映射为：

```text
Art1 = FireSkill1（烈火一式）
Art2 = FireSkill2（烈火二式）
Art3 = FireSkill3（烈火三式）
```

## 5. Routine Tile（套路牌）规则

技能命中后，敌人身上新增 Routine Tile（套路牌）：

```js
{
  routineId: 'FireRoutine',
  layer: 1,
  sourceSkillId: 'FireSkill1',
  createdFrame: actor.frame
}
```

规则：

- 只有命中才添加 Routine Tile（套路牌）。
- Whiff（打空）不添加。
- 敌人身上最多保留最近 3 张 Routine Tile（套路牌）。
- 超过 3 张时移除最旧牌。
- 每次新增后检查是否形成 Routine Orb（套路球）。

事件：

```text
RoutineTileAdded（套路牌加入）
RoutineTileRemoved（套路牌移除）
```

## 6. Routine Orb（套路球）规则

MVP 只做一个牌型：

```text
SameRoutineTriple（三张同套路）
```

当最近三张 Routine Tile（套路牌）都属于 FireRoutine（烈火套路）时，创建：

```js
{
  id: 'FireRoutineOrb',
  routineId: 'FireRoutine',
  pattern: 'SameRoutineTriple',
  layers: [1, 2, 3],
  totalLayer: 6,
  createdFrame: actor.frame
}
```

事件：

```text
RoutineOrbCreated（套路球创建）
RoutineOrbReplaced（套路球替换）
```

第一版不做复杂顺子、刻子、高番、混搭牌型。

## 7. Break Routine Orb（削球）规则

新增 core（核心逻辑层）方法：

```js
actor.breakRoutineOrb()
```

没有 RoutineOrb（套路球）时：

```text
RoutineOrbBreakFailed reason=no_orb
```

有 FireRoutineOrb（烈火套路球）时：

```text
RoutineOrbBreakStarted（削球开始）
RoutineOrbBroken FireRoutineOrb（套路球被削）
ElementDamageApplied Fire damage=totalLayer*20（套路属性伤害生效）
DebuffApplied Burn duration=300f（燃烧负面状态附加）
RoutineOrbBreakFinished（削球结束）
```

例子：

```text
layers = [1, 2, 3]
totalLayer = 6
damage = 6 * 20 = 120
```

## 8. Debuff（负面状态）规则

MVP 只做 Burn（燃烧）：

```js
{
  id: 'Burn',
  damagePerTick: 5,
  tickIntervalFrames: 60,
  framesLeft: 300
}
```

规则：

- Burn（燃烧）每 60 帧造成 5 点 HpDamage（生命伤害）。
- 持续 300 帧。
- 触发 DebuffTickDamage（负面状态跳伤）。
- 过期触发 DebuffExpired（负面状态过期）。
- 如果 Burn（燃烧）击败目标，也要触发 TargetDefeated（目标被击败）和 BattleEnded Victory（战斗结束：胜利）。

## 9. HP / Damage / Battle Result（生命 / 伤害 / 战斗结果）

V4.0 必须补齐可玩战斗基础：

```js
target: { maxHp, hp, dead }
player: { maxHp, hp, dead }
battle: { active, result: null | 'Victory' | 'Defeat' }
```

MVP 先实现 Victory（胜利）。Defeat（失败）等 NPC AI（敌人 AI）阶段再做。

事件：

```text
BattleStarted（战斗开始）
DamageApplied（伤害生效）
TargetHpChanged（目标生命变化）
TargetDefeated（目标被击败）
BattleEnded（战斗结束）
```

## 10. Single Driver Routine-Orb MVP（单人驱动者 + 套路挂球 MVP）流程

目标流程：

```text
BattleStarted（战斗开始）
  ↓
FireSkill1 hit（烈火一式命中）
  ↓
DamageApplied（伤害生效） + RoutineTileAdded L1（套路牌 L1 加入）
  ↓
FireSkill2 hit（烈火二式命中）
  ↓
RoutineTileAdded L2（套路牌 L2 加入）
  ↓
FireSkill3 hit（烈火三式命中）
  ↓
RoutineTileAdded L3（套路牌 L3 加入）
  ↓
RoutineOrbCreated FireRoutineOrb（创建烈火套路球）
  ↓
Break Routine Orb（削球）
  ↓
ElementDamageApplied（套路属性伤害）
  ↓
DebuffApplied Burn（附加燃烧）
  ↓
DebuffTickDamage（燃烧跳伤）
  ↓
TargetDefeated（目标被击败）
  ↓
BattleEnded Victory（战斗胜利）
```

## 11. 与已有系统的关系

不要删除或替换已有系统：

- Driver Combo（驱动者连击）保留。
- Special Gauge（必杀技计量）保留。
- Blade Combo（异刃连击路线）保留。
- Token（延迟奖励资源）保留。

Routine-Orb（套路挂球）是 Single Driver MVP（单人驱动者最小可玩版本）的新挂球路径。它可以和 Token（延迟奖励资源）并存，未来再决定是否统一抽象。

## 12. 明确不做

本设计原型不要求实现：

```text
Chain Attack（连锁攻击阶段）
Full Burst（最终爆发）
Fusion Combo（融合连击）
NPC AI（敌人 AI）
Party AI（队伍 AI）
多人战斗
复杂牌型
复杂数值平衡
```

## 13. 下一任务建议

下一开发任务建议为：

```text
V4.0 Single Driver Routine-Orb Combat MVP
```

验收标准：

- 三个同套路技能能创建 RoutineOrb（套路球）。
- breakRoutineOrb() 能削球。
- 削球能造成 ElementDamageApplied（套路属性伤害）。
- 削球能附加 Burn（燃烧）。
- Burn（燃烧）能造成持续伤害。
- target.hp（目标生命值）会下降。
- target 能死亡。
- BattleEnded Victory（战斗胜利）会触发。
- UI 能看到 Target HP（目标血量）、Routine Tiles（套路牌）、Routine Orb（套路球）、Debuffs（负面状态）、Victory（胜利）。
- 不实现 Chain Attack（连锁攻击阶段）、Full Burst（最终爆发）、Fusion Combo（融合连击）。
