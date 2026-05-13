# V5 Backpack + Beast Blade Design Index（背包 + 兽型异刃设计索引）

V5 的核心方向：Driver（驱动者）通过 Backpack Loadout（背包构筑）携带多个 Blade（异刃）。Blade 本体占 Driver Backpack（驱动者背包）格子；Blade 自己有 Internal Equipment（内部装备界面）；内部装备可以在 Blade footprint（异刃占地）内生成 Socket（嵌入槽位）。

V5.2 之后，Blade 不再只是“职业插件”，而是 Beast Blade（兽型异刃）：有物种、品系、个体特质、羁绊、战斗技能和生活技能。

## 阅读顺序

1. `docs/backpack-loadout-design.md`
2. `docs/blade-nested-socket-design.md`
3. `docs/v5.1-backpack-blade-mvp-spec.md`
4. `docs/beast-blade-archetype-design.md`
5. `docs/blade-bond-system-design.md`
6. `docs/beast-blade-life-skills-design.md`
7. `docs/v5.2-beast-blade-archetype-spec.md`

## 核心原则

- Combat（战斗）不应每帧扫描 9×9 背包。
- Combat 只读取 ResolvedLoadout（解析后构筑）。
- Blade 本体不自带 Element（属性）。
- Element 来自 Blade 内部 socket 中的 ElementCore（元素核心）。
- Driver Backpack 只放 Blade 本体与其他大物品；Blade 内部装备不直接占 Driver Backpack 格子。
- Socket 必须完全位于 Blade footprint 内。
- 玩家不直接看到完整隐藏属性点。
- 玩家看到的是动物、性格、习性、技能倾向、生活特长、羁绊状态。
- 稀有度提高的是构筑可能性、特殊机制和成长空间，不是单纯数值碾压。

## 推荐里程碑

### V5.1 Backpack Blade MVP

- 9×9 背包数据结构。
- BladeItem（异刃物品）占格。
- SlotModule 在异刃占地内生成 1×1 socket。
- ElementCore 赋予异刃 element。
- LoadoutResolver 输出 activeBlades。
- BladeRuntime 自动攻击。

### V5.2 Beast Blade Archetype Design（仅文档 — 已完成）

- 设计 Bear/Tiger/Wolf/Turtle/Eagle/Snake 六种物种。
- 设计 Wolf 四种品系（GreyWolf/SnowWolf/RedWolf/MoonWolf）。
- 设计 6 种个体特质、4 级稀有度、隐藏属性模板。
- 设计战斗技能池与生活技能池（15 种 LifeSkillTag）。
- 设计羁绊系统三维度边界（Trust/Mood/Sync）。
- 交付物：`docs/beast-blade-archetype-design.md`、`docs/blade-bond-system-design.md`、`docs/beast-blade-life-skills-design.md`、`docs/v5.2-beast-blade-archetype-spec.md`

### V5.3 Beast Blade Archetype MVP（未来）

- 实现 Wolf / Bear / Tiger 三种物种各 1-2 品系。
- 隐藏属性影响 BladeRuntime。
- 个体特质影响简单触发。
- LifeSkills 出现在 resolvedLoadout。
- element 仍来自 ElementCore，不来自 species。

### V5.4 Bond System MVP（未来）

- Trust / Mood / Sync 三维度实现。
- 战斗事件驱动羁绊提升。
- 羁绊等级解锁 socket 或技能触发。

### V5.5 Life Skill Hook（未来）

- LifeSkillTag / LifeSkillLevel / resolvedLoadout.activeLifeSkills。
- 不实现完整采集、狩猎、挖矿玩法。
