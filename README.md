# BattleSystem

浏览器优先的战斗系统验证沙盒，用来快速验证“异度之刃 2-like”的底层战斗闭环与最小 Combo 原型。

```text
普攻命中
  ↓
Arts 充能（普攻资源）
  ↓
后摇取消（到移动 / 到 Arts）
  ↓
Arts 命中（可选：Driver Combo）
  ↓
Special Gauge 充能（由 Arts 命中驱动）
  ↓
释放 Special（命中推进 Blade Combo）
  ↓
完成路线产出 Token（仅产出，不兑现）
```

V4.0 额外闭环（Single Driver Routine-Orb MVP）：

```text
Arts 命中（映射为套路技能）
  ↓
生成 Routine Tiles（最多 3 张）
  ↓
3 张同 Routine => 生成 Routine Orb（套路球）
  ↓
破球（元素伤害 + Burn）
  ↓
Burn tick 可击杀 => BattleEnded(Victory)
```

V4.2 额外闭环（Enemy Attack MVP）：

```text
敌人在范围内
  ↓
发动 EnemyStrike（敌人普通攻击）
  ↓
Startup / Active / Recovery（动作阶段）
  ↓
EnemyAttackHit => PlayerDamageApplied（玩家掉血）
  ↓
PlayerDefeated + BattleEnded(Defeat)（可失败）
```

明确边界：<= V4.2 不实现 Chain Attack / Full Burst / Fusion 等 payoff 机制；Orbs 仅实现 “Routine Orb（套路球）” 的最小闭环，不覆盖复杂属性球系统与连锁兑现；Enemy 仅实现单敌人、单技能（EnemyStrike）的最小攻击闭环，不实现追击/寻路/行为树/仇恨系统。
如进入后续 V4.x，必须先完成 Readiness Review 与拆分计划（见 `docs/v4-readiness-review.md`），且不得在同一里程碑中同时引入“大玩法 + 工程扩张”。

## V4.1 Enemy Attack Model Design（敌人攻击模型设计）

V4.1 是设计阶段，不实现复杂 NPC AI（敌人 AI）。它为 V4.2 Enemy Attack MVP Implementation（敌人攻击最小实现）提供开发规格：

- `docs/enemy-attack-model.md`
- `docs/npc-ai-design.md`
- `docs/v4.2-enemy-attack-mvp-spec.md`

## V4.2 Enemy Attack MVP（已实现）

- core：新增 EnemyStrike 配置与 enemy runtime state；敌人按距离与冷却自动发起攻击；命中可让玩家掉血并触发 Defeat。
- 可观察性：新增 `EnemyAttack*`、`PlayerDamageApplied/PlayerHpChanged/PlayerDefeated` 等事件；`getSnapshot()` 扩展 `snapshot.enemy/snapshot.player/snapshot.battle`。
- 一键验证入口：
  - Node：`npm test`（包含 enemy-attack/enemy-strike scenarios 与断言）。
  - Browser：右侧 Debug 面板 “Enemy/Player” 区块与 Scenario 按钮可直接复现 hit/whiff/defeat 等场景（不依赖键盘焦点）。

## V4.3 Player Defeat / Battle Failure Polish（设计中）

V4.3 是失败体验打磨阶段，不新增大玩法。目标是把 `BattleEnded Defeat（战斗失败）` 从事件结果打磨成稳定、可观察、可测试、可 reset 的失败体验。

设计文档：

- `docs/player-defeat-polish-design.md`
- `docs/v4.3-player-defeat-polish-spec.md`

## V5.1 Backpack Blade MVP（已实现）

V5.1 实现最小 Backpack（背包）+ Blade（异刃）+ Nested Socket（嵌套槽位）+ Blade Auto Attack 闭环：

- core：新增 `backpack-grid.js`（9×9 背包网格）、`backpack-items.js`（物品定义）、`loadout-resolver.js`（构筑解析器）、`blade-runtime.js`（异刃战斗单位自动攻击）。
- 可观察性：新增 11 个 Blade/Backpack 事件（`BackpackResolved`、`BladeLinked`、`BladeAttackHit` 等）；`getSnapshot()` 扩展 `snapshot.backpack/resolvedLoadout/bladeRuntimes`。
- 一键验证入口：
  - Node：`npm test`（包含 backpack-grid/loadout-resolver/blade-runtime/backpack-blade-scenario 测试）。
  - Browser：右侧 Debug 面板 "Backpack / Blades" 区块显示 Blade 状态；Canvas 绘制 BladeRuntime 标记。

不做：拖拽 UI、物品旋转、Blade 独立寻路、Blade 复杂 AI、Chain Attack / Full Burst / Fusion Combo。

## V5.2 Beast Blade Archetype Design（兽型异刃原型设计 — 仅文档）

V5.2 是纯设计文档里程碑，不实现代码。将 Beast Blade（兽型异刃）的设计框架正式进入仓库，为后续 V5.3~V5.5 实现提供策划口径与架构约束：

- `docs/beast-blade-archetype-design.md`：物种/品系/个体特质/稀有度/隐藏属性/技能池/ElementCore 关系
- `docs/blade-bond-system-design.md`：Trust/Mood/Sync 三维羁绊系统设计
- `docs/beast-blade-life-skills-design.md`：15 种 LifeSkillTag 与等级接口设计
- `docs/v5.2-beast-blade-archetype-spec.md`：V5.2/V5.3/V5.4/V5.5 后续规格草案

核心设计原则：异刃是动物型战斗伙伴（Beast Blade），不是单纯职业插件。稀有度提高构筑可能性与特殊机制，非简单数值碾压。element 仍来自 ElementCore。羁绊改变行为而非纯数值加成。

## V1 目标与边界

这个仓库不是完整游戏项目，而是一个可重复验证战斗节奏的原型沙盒（浏览器可跑 + Node 可重复测试）：

Implemented / planned in the first browser prototype:

- Fixed-frame combat simulation.
- Player movement intent.
- Auto attack chain: `AA1 -> AA2 -> AA3`.
- Action phases: `Startup / Active / Recovery / Finished`.
- `Startup` cannot be soft-canceled by movement or art input.
- `Active` fires hit events and art charge.
- `Recovery` can be canceled into movement or ready arts.
- Short art input buffer.
- Cancel bonus window after hit.
- Browser HTML visual validation loop + Node tests.

## V2 Driver Combo（已实现）

在不扩玩法的前提下，增加一层“控制链”验证（通过武技命中推进）：

```text
Break -> Topple -> Launch -> Smash
```

默认键位与 effect 绑定：

```text
1: Art1 (Break)
2: Art2 (Topple)
3: Art3 (Launch)
4: Art4 (Smash)
```

所有推进/失败/过期/完成都可通过事件日志与右侧面板观察（详见 `docs/validation-plan.md`）。

## V3 Special / Blade Combo / Token（已实现）

- Arts 命中会为 Special Gauge 充能（默认每个 Art 都有 `specialChargeGain`）。
- Special 有等级（L1~L3）与消耗；释放成功会记录消费与命中事件。
- Special 命中会推进 Blade Combo 路线（默认示例路线：`Fire(L1) -> Water(L2) -> Fire(L3)`）。
- 路线完成后会创建一个 Token 并记录 `TokenCreated`（当前仅用于“延迟奖励输入”的可观察性验证，不包含兑现机制）。

## V3.1 文档同步与验收口径（已实现）

V3.1 不新增玩法实现，只做“文档同步 + 可观察性验收口径对齐”，用于避免后续扩展时出现规则漂移：

- README / AGENTS / docs 路线图与验收计划对齐。
- 明确 V4 的预研内容只允许以 Readiness Review + 拆分计划形式进入仓库（不直接落玩法）。

## V4.0 Single Driver Routine-Orb MVP（已实现）

- 新增 Battle/HP/Result（可击杀目标 + 统一扣血通路 + Victory 结束判定）。
- 新增 Routine Orb（套路球）最小闭环：tiles/orb/破球/Burn/tick/击杀。
- 一键验证入口：
  - Node：`npm test`（包含 routine-orb 与 single-driver-mvp tests/scenarios）。
  - Browser：右侧 Debug 面板的 Scenario 按钮可运行 `single-driver-routine-orb-victory` 等场景，并在 “Single Driver MVP” 区块展示 HP/tiles/orb/burn 与关键事件。

## V4.x Chain Attack 预研（未来，仅文档）

V4.x 预研的目标是把未来可能的 Chain Attack / Full Burst / Fusion 与更完整的 Orbs cash-out 拆成“可观察、可测试、可分阶段落地”的计划，而不是在当前仓库直接实现大玩法。
详见 `docs/v4-readiness-review.md`。

## V1 目录结构

```text
index.html              模块装配入口（不再塞战斗逻辑）
src/core/               纯战斗核心：不依赖 DOM / Canvas
src/data/               默认数值与配置装配
src/ui/                 浏览器输入、Canvas 渲染、Debug 面板、沙盒 App
src/dev/                纯逻辑验证工具：scenario runner、trace recorder、内置 scenarios
tests/                  Node 可重复测试
docs/                   架构与模型说明
tools/serve.py          本地静态服务（可选）
```

## Run

推荐两种方式：

1) 直接用浏览器打开 `index.html`。
2) 起本地静态服务：

```bash
npm start
```

Controls:

```text
WASD / Arrow Keys : move
1/2/3/4           : use Art1/Art2/Art3/Art4
Space             : pause / resume
R                 : reset
.                 : step one frame
```

Special/Blade/Scenario 建议通过右侧 Debug 面板按钮验证（不依赖键盘焦点）。

## Test

```text
npm test
```

## Design notes

- Movement is a combat input, not just locomotion.
- Movement blocks auto-attack startup when the actor is free.
- Once an attack enters startup, normal movement cannot soft-cancel it.
- Recovery cancel and cancel bonus are separate concepts.
- All important decisions should be observable through logs or debug UI.

## Next steps

See:

- `docs/architecture.md`
- `docs/validation-plan.md`
- `docs/roadmap.md`
- `docs/system-map.md`
- `docs/mechanics-map.md`
- `docs/event-catalog.md`
- `docs/test-coverage-map.md`
- `docs/routine-orb-system.md`
- `docs/enemy-attack-model.md`
- `docs/npc-ai-design.md`
- `docs/v4.2-enemy-attack-mvp-spec.md`
- `docs/player-defeat-polish-design.md`
- `docs/v4.3-player-defeat-polish-spec.md`
- `docs/v5-backpack-blade-index.md`
- `docs/beast-blade-archetype-design.md`
- `docs/blade-bond-system-design.md`
- `docs/beast-blade-life-skills-design.md`
- `docs/v5.2-beast-blade-archetype-spec.md`
- `docs/v3-readiness-review.md`
- `docs/v4-readiness-review.md`
