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

## V5：Single Driver + Blade Production Flow（单人驱动者 + 异刃正式流程）（未来）

状态：未来。

范围：Driver（驱动者）与 Blade（异刃）的正式数据关系、activeBlade（当前异刃）、Blade specials（异刃必杀）、非 debug 的异刃连击入口。

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
