# 路线图（Roadmap）

BattleSystem 会从“浏览器验证沙盒”逐步长成可复用的战斗核心。每个阶段都优先保证：可解释、可验证、可测试。

## V0：普攻 + 武技闭环（完成）

状态：完成。

范围：固定帧模拟、移动意图、普攻链、动作阶段、武技充能与消费、输入缓冲、后摇取消、Cancel Bonus（取消奖励）、事件日志 + Debug UI。

## V1：模块化战斗核心（完成）

状态：完成。

范围：

```text
src/core/   纯逻辑核心（不依赖 DOM/Canvas）
src/data/   默认数值与装配
src/ui/     浏览器输入/渲染/调试 UI
tests/      Node 可重复测试
```

## V2：Driver Combo（驱动者连击）原型（完成）

状态：完成。

```text
Break（破防） -> Topple（倒地） -> Launch（浮空） -> Smash（猛击）
```

## V2.1：Observability Validation Harness（可观察性验证工具）（完成）

状态：完成。

范围：Scenario Runner（脚本化场景运行器）、Trace Recorder（逐帧追踪记录器）、一键 Run 按钮、PASS/FAIL + proof（证明链）。

## V2.2：System Map and Mechanic Inventory（系统地图与机制盘点）（完成）

状态：完成。

交付物：system map、mechanics map、event catalog、test coverage map、V3 readiness review。

## V3：Special / Blade Combo / Token（必杀技 / 异刃连击 / 延迟奖励资源）原型（完成）

状态：完成。

范围：Special Gauge（必杀技计量）、Special（必杀技）、Blade Combo（异刃连击路线）、TokenCreated（延迟奖励资源创建）。

## V3.1：文档同步 + 可观察性验收口径（完成）

状态：完成。

范围：完整链路 scenario、V4 readiness 文档、验收口径同步。

## V4.0：Single Driver Routine-Orb MVP（单人驱动者 + 套路挂球 MVP）（完成）

状态：完成。

范围：Battle/HP/Result（战斗/生命/结果）、RoutineTile（套路牌）、RoutineOrb（套路球）、Break RoutineOrb（削球）、Burn（燃烧）、Victory（胜利）。

明确不包含：Chain Attack（连锁攻击阶段）、Full Burst（最终爆发）、Fusion Combo（融合连击）、复杂属性球兑现。

## V4.1：Enemy Attack Model Design（敌人攻击模型设计）（完成）

状态：完成。

范围：只做设计文档，不实现敌人 AI（敌人自动战斗逻辑）。

交付物：

- `docs/enemy-attack-model.md`
- `docs/npc-ai-design.md`
- `docs/v4.2-enemy-attack-mvp-spec.md`

## V4.2：Enemy Attack MVP Implementation（敌人攻击最小实现）（完成）

状态：完成。

范围：EnemyAttackSpec（敌人攻击配置）、Enemy Runtime State（敌人运行时状态）、EnemyAttackHit（敌人攻击命中）、PlayerDamageApplied（玩家受到伤害）、PlayerDefeated（玩家被击败）、BattleEnded Defeat（战斗失败）。

不做：复杂行为树、寻路、多敌人、队友 AI、完整 Aggro（仇恨）系统、Chain Attack（连锁攻击阶段）、Full Burst（最终爆发）、Fusion Combo（融合连击）。

## V4.2.1：Enemy Combat Polish（敌人战斗打磨）（进行中 / 待合并）

状态：进行中。

范围：敌人事件命名收敛、Canvas（画布）结构化读取 enemy outcome（敌人命中/打空结果）、Defeat（失败）后 stale action（残留动作）清理、scenario finalSnapshot（场景最终快照）修复。

## V4.3：Player Defeat / Battle Failure Polish（玩家失败与战斗失败打磨）（设计中）

状态：设计中。

交付物：

- `docs/player-defeat-polish-design.md`
- `docs/v4.3-player-defeat-polish-spec.md`

目标：把 `BattleEnded Defeat（战斗失败）` 从事件结果打磨成稳定、可观察、可测试、可 reset（重置）的失败体验。

## V5.0：Backpack Blade Design（背包异刃设计）（完成）

状态：完成。

交付物：

- `docs/v5-backpack-blade-index.md`
- `docs/backpack-loadout-design.md`
- `docs/blade-nested-socket-design.md`
- `docs/v5.1-backpack-blade-mvp-spec.md`

## V5.1：Backpack Blade MVP（背包异刃最小实现）（完成）

状态：完成。

范围：9×9 BackpackGrid（背包网格）、BladeItem（异刃物品）占格、Nested Socket（嵌套槽位）、LoadoutResolver（构筑解析器）、BladeRuntime（异刃战斗单位）自动攻击。BladeAttackHit 带 element 并造成伤害。

不做：拖拽 UI、物品旋转、Blade 独立寻路、Blade 复杂 AI、Chain Attack / Full Burst / Fusion Combo。

新增文件：`src/core/backpack-grid.js`、`src/core/backpack-items.js`、`src/core/loadout-resolver.js`、`src/core/blade-runtime.js`。新增 11 个 Blade/Backpack 事件、6 个 scenarios、4 个测试文件。

## V5.2：Beast Blade Archetype Design（兽型异刃原型设计文档集成）（完成）

状态：完成。

范围：仅设计文档，不实现代码。

交付物：

- `docs/beast-blade-archetype-design.md`
- `docs/blade-bond-system-design.md`
- `docs/beast-blade-life-skills-design.md`
- `docs/v5.2-beast-blade-archetype-spec.md`

明确不做：不写任何 gameplay code，不改 src/core / src/ui / tests，不实现兽型异刃/羁绊/生活技能代码。

## V5.3：Beast Blade Archetype MVP（完成）

状态：完成。

范围：Wolf/Bear/Tiger 三种物种各 1-2 品系；隐藏属性影响 BladeRuntime；个体特质影响简单触发；LifeSkills 出现在 resolvedLoadout；element 仍来自 ElementCore。

交付物：

- `src/core/beast-blade.js`：Species/Lineage/Rarity/IndividualTrait/HiddenStatProfile 定义与解析
- `src/core/life-skills.js`：LifeSkillTag/LifeSkillEntry/mergeLifeSkills
- 4 种 Beast Blade 物品（GreyWolf/MoonWolf/BrownBear/BengalTiger）
- LoadoutResolver/BladeRuntime/combat-actor 扩展
- 新增 BladeSpeciesResolved/BladeTraitActivated 事件
- 3 个测试文件（archetype 17 + runtime 8 + scenario 6）+ 6 个 scenarios
- Debug Panel/Canvas UI 扩展

明确不做：Bond runtime / Life Skill gameplay / Chain Attack / Full Burst / Fusion Combo

## V5.3.1：BladeRuntime Constructor Cleanup（完成）

状态：完成。

范围：纯结构性重构，无新玩法。将 BladeRuntime 构造函数的 11 个扁平参数收敛为单个 `resolvedBlade` 对象，消除参数顺序耦合，为 V5.4 Bond System 接入做准备。

不做：任何玩法变更。

## V5.4：Bond System MVP（未来）

状态：未来。

范围：Trust/Mood/Sync 三维度实现；战斗事件驱动羁绊提升；羁绊等级解锁 socket 或技能触发。

## V5.5：Life Skill Hook（未来）

状态：未来。

范围：LifeSkillTag + LifeSkillLevel + resolvedLoadout.activeLifeSkills。不做完整采集/狩猎/挖矿玩法。

## V6：Party Battle（队伍战斗）（未来）

状态：未来。

范围：队友 AI、多个 Driver（驱动者）、多个 Blade（异刃）、Aggro（仇恨）、治疗、坦克、多人协作连击。

## V7+：高级结算机制（未来，延后）

状态：未来。

范围：Chain Attack（连锁攻击阶段）、Full Burst（最终爆发）、Fusion Combo（融合连击）、复杂属性球兑现。

这些机制必须在单人战斗 + 敌人攻击 + 失败体验稳定 + 队伍基础之后再做。

## 工程原则

- 战斗规则必须可解释。
- 关键状态变化必须可观察：日志、Snapshot（状态快照）、Scenario proof（场景证明链）。
- 动作时序与取消权限由数据驱动，不由 UI 特判。
- 文档设计由制作/架构负责；本地大模型主要负责按 SPEC（规格）编程实现。
