# V5 Backpack + Blade Design Index（背包 + 异刃设计索引）

> 本索引是 V5 阶段入口。V5 的核心方向：Driver（驱动者）通过 Backpack Loadout（背包构筑）携带多个 Blade（异刃）。Blade 本体占 Driver Backpack（驱动者背包）格子；Blade 自己有 Internal Equipment（内部装备界面）；内部装备可以在 Blade footprint（异刃占地）内生成 Socket（嵌入槽位）。

## 1. 当前主线状态

截至 V4.3，系统已完成：

- Single Driver Routine-Orb MVP（单人驱动者 + 套路挂球 MVP）。
- Enemy Attack MVP（敌人攻击最小实现）。
- Player Defeat Polish（玩家失败体验打磨）。

V5 不继续扩 Chain Attack（连锁攻击阶段）、Full Burst（最终爆发）、Fusion Combo（融合连击）。V5 先解决“角色如何通过背包构筑携带多个异刃，并让异刃作为战斗单位参与攻击”。

## 2. 阅读顺序

1. `docs/backpack-loadout-design.md`
   - Driver Backpack（驱动者背包）、9×9 网格、物品占格、合法放置、Loadout Resolver（构筑解析器）。
2. `docs/blade-nested-socket-design.md`
   - Blade Item（异刃物品）、Blade Internal Equipment（异刃内部装备）、Slot Module（槽位扩展装备）、Generated Socket（生成插槽）。
3. `docs/v5.1-backpack-blade-mvp-spec.md`
   - 给本地开发模型执行的 V5.1 Backpack Blade MVP（背包异刃最小实现）规格。

## 3. 核心术语

| Term | 中文 | 说明 |
| --- | --- | --- |
| Driver Backpack | 驱动者背包 | 9×9 主构筑空间。 |
| Backpack Item | 背包物品 | 放入背包并占格的物品。 |
| Blade Item | 异刃物品 | 放在背包里的异刃本体，占 2×2、3×2、3×3 等空间。 |
| Blade Runtime | 异刃战斗单位 | 战斗开始后由 Blade Item 解析出的可攻击单位。 |
| Blade Role | 异刃定位 | MVP 只做 Tank（肉）/ DPS（输出）。 |
| Blade Internal Equipment | 异刃内部装备 | 异刃自己界面里的装备，不直接占 Driver Backpack 格子。 |
| Slot Module | 槽位扩展装备 | 异刃内部装备之一，用于在异刃占地内生成 socket。 |
| Generated Socket | 生成插槽 | 由 Slot Module 在 Blade footprint 内生成的可插入格。 |
| Socket Item | 插槽物品 | 放入 Generated Socket 的小物品，如 Core（核心）、Rune（符文）。 |
| Loadout Resolver | 构筑解析器 | 把背包布局解析成战斗可用的 ResolvedLoadout（解析后构筑）。 |

## 4. 架构原则

- Combat（战斗）不应每帧扫描 9×9 背包。
- 战斗只读取 `ResolvedLoadout（解析后构筑）`。
- Blade（异刃）本体不自带 Element（属性）。
- Blade 的 Element（属性）来自 Blade 内部装备 / socket 中的 Core（核心）。
- Driver Backpack（驱动者背包）只放 Blade 本体与其他大物品；Blade 内部装备不直接占 Driver Backpack 格子。
- Socket（嵌入槽）必须完全位于 Blade footprint（异刃占地）内部。
- V5.1 不做拖拽 UI、不做旋转、不做复杂形状、不做复杂多异刃 AI。

## 5. 推荐里程碑

### V5.0 Design（当前）

只提交设计文档，不改玩法代码。

### V5.1 Backpack Blade MVP（完成）

- 9×9 背包数据结构。
- BladeItem（异刃物品）占格。
- SlotModule（槽位模块）在异刃占地内生成 1×1 socket。
- Socket 插入 ElementCore（元素核心）。
- LoadoutResolver 输出 activeBlades（激活异刃）。
- BladeRuntime 自动攻击。
- BladeAttackHit 带 element（属性）并造成伤害。

已实现，见 PR #17。

### V5.2 Blade Role Polish（未来）

- Tank Blade（肉异刃）降低玩家受到的伤害。
- DPS Blade（输出异刃）提高异刃输出。

### V5.3 Backpack Synergy（未来）

- 更多 socket 形状。
- 更多异刃类型。
- 背包邻接/范围加成。

## 6. 明确不做

V5.0 / V5.1 不做：复杂拖拽 UI、物品旋转、多背包页、异刃寻路、异刃复杂 AI、异刃自己挂 RoutineOrb（套路球）、Chain Attack（连锁攻击阶段）、Full Burst（最终爆发）、Fusion Combo（融合连击）。
