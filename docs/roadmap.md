# 路线图（Roadmap）

BattleSystem 会从“浏览器验证沙盒”逐步长成可复用的战斗核心。每个阶段都优先保证：可解释、可验证、可测试。

## 已完成阶段

| 阶段 | 状态 | 核心内容 |
| --- | --- | --- |
| V0 | 完成 | 普攻 + 武技基础闭环。 |
| V1 | 完成 | 模块化战斗核心：`src/core` 纯逻辑、`src/ui` 浏览器壳、`tests` Node 测试。 |
| V2 | 完成 | Driver Combo（驱动者连击）：Break -> Topple -> Launch -> Smash。 |
| V2.1 | 完成 | Scenario Runner（脚本化场景运行器）+ Trace Recorder（逐帧追踪记录器）。 |
| V2.2 | 完成 | System Map（系统地图）、Mechanics Map（机制图）、Event Catalog（事件目录）、Test Coverage Map（测试覆盖图）。 |
| V3 | 完成 | Special Gauge（必杀技计量）/ Blade Combo（异刃连击）/ Token（延迟奖励资源）。 |
| V3.1 | 完成 | Full Battle Loop（完整战斗链路验证）与文档同步。 |
| V4.0 | 完成 | Single Driver Routine-Orb MVP（单人驱动者 + 套路挂球 MVP）。 |
| V4.1 | 完成 | Enemy Attack Model Design（敌人攻击模型设计）。 |
| V4.2 | 完成 | Enemy Attack MVP（敌人攻击最小实现）。 |
| V4.2.1 | 完成 | Enemy Combat Polish（敌人战斗打磨）。 |
| V4.3 | 完成 | Player Defeat / Battle Failure Polish（玩家失败与战斗失败打磨）。 |

## V5.0：Backpack + Blade Nested Socket Design（背包 + 异刃嵌套槽位设计）（当前）

状态：当前，设计阶段。

目标：把原先“固定异刃槽”改为 Backpack Loadout（背包构筑）：Driver（驱动者）拥有 9×9 Driver Backpack（驱动者背包），Blade（异刃）作为背包物品占格存在；Blade 自己有 Internal Equipment（内部装备界面），内部装备可在 Blade footprint（异刃占地）内生成 Socket（嵌入槽位）。

交付物：

- `docs/v5-backpack-blade-index.md`
- `docs/backpack-loadout-design.md`
- `docs/blade-nested-socket-design.md`
- `docs/v5.1-backpack-blade-mvp-spec.md`

## V5.1：Backpack Blade MVP（背包异刃最小实现）（未来）

状态：未来。

范围：

- 9×9 背包数据结构。
- BladeItem（异刃物品）占格。
- SlotModule（槽位扩展装备）生成 1×1 socket。
- ElementCore（元素核心）插入 socket 后提供 element（属性）。
- LoadoutResolver（构筑解析器）输出 activeBlades（激活异刃）。
- BladeRuntime（异刃战斗单位）自动攻击。
- BladeAttackHit（异刃攻击命中）带 element 并造成伤害。

不做：拖拽 UI、旋转、复杂形状、异刃复杂 AI、异刃自己挂 RoutineOrb（套路球）、Chain Attack（连锁攻击阶段）、Full Burst（最终爆发）、Fusion Combo（融合连击）。

## V5.2：Blade Role Polish（异刃定位打磨）（未来）

状态：未来。

范围：

- Tank Blade（肉异刃）降低玩家受到的伤害。
- DPS Blade（输出异刃）提高异刃输出。
- 明确多异刃同时存在时的角色分工。

## V5.3：Backpack Synergy（背包协同）（未来）

状态：未来。

范围：更多 socket 形状、更多异刃类型、背包邻接/范围加成、更多内部装备类型。

## V6：Party Battle（队伍战斗）（未来）

状态：未来。

范围：队友 AI、多个 Driver（驱动者）、多个 Blade（异刃）、Aggro（仇恨）、治疗、坦克、多人协作连击。

## V7+：高级结算机制（未来，延后）

状态：未来。

范围：Chain Attack（连锁攻击阶段）、Full Burst（最终爆发）、Fusion Combo（融合连击）、复杂属性球兑现。

这些机制必须在单人战斗 + 敌人攻击 + 失败体验稳定 + 背包异刃构筑 + 队伍基础之后再做。

## 工程原则

- 战斗规则必须可解释。
- 关键状态变化必须可观察：日志、Snapshot（状态快照）、Scenario proof（场景证明链）。
- Combat（战斗）不应每帧扫描 Backpack（背包）；战斗只读 ResolvedLoadout（解析后构筑）。
- 动作时序与取消权限由数据驱动，不由 UI 特判。
- 文档设计由制作/架构负责；本地大模型主要负责按 SPEC（规格）编程实现。
