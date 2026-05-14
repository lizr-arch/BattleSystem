# AGENTS.md

本文件是 BattleSystem 仓库的开发代理规范。任何本地大模型、Codex、自动化脚本或人工开发者在修改本仓库前，都必须先阅读并遵守本文件。

## 1. 项目定位

BattleSystem 当前不是完整游戏项目，而是一个用于快速验证“异度之刃 2-like”战斗系统底层循环的浏览器优先原型。

当前核心闭环（V1~V3）：

```text
输入意图
  ↓
动作状态机
  ↓
Startup / Active / Recovery
  ↓
普攻命中
  ↓
武技充能
  ↓
后摇取消
  ↓
武技命中（可选：Driver Combo）
  ↓
Special Gauge 充能（由武技命中驱动）
  ↓
Special 消费与命中（推进 Blade Combo）
  ↓
Blade Combo 完成产出 Token（仅产出，不兑现）
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

V5.5.2 额外闭环（Trait Combat Payoff MVP）:

```text
BondCombatSlot1 解锁（trustLevel >= 3）
  ↓
BladeAttackHit / EnemyAttackHit / BondSyncTriggered
  ↓
消费 trait + combat slot → FierceFollowUp / LoyalGuard / ProudSyncStrike
  ↓
TraitPayoffActivated 事件 + DamageApplied 统一通路
```

术语（中英对照，后续文档与事件命名统一口径）：

- Routine：套路
- Tile：套路牌
- Orb：套路球
- Orb Break：破球
- Burn：灼烧
- Chain Attack：连锁攻击（V4.0 延后）

当前阶段：V5.1 Backpack Blade MVP 已实现；当前里程碑以“文档同步 + 可观察性验收口径 + audit:map 门禁”为主（不新增额外玩法扩展，除非用户明确要求）。

主要目标：

- 保持浏览器沙盒可运行。
- 保持战斗核心可测试、可迁移、可解释。
- 用最小工程复杂度验证机制，不提前扩成完整游戏。

## 2. 角色分工

本地模型/开发代理的角色：

- 主程序。
- 前端验证工具开发。
- 简单调试 UI / 可视化实现。
- 必要的文档维护。

制作人/架构负责人意图：

- 先做机制验证，再做表现扩展。
- 先维护核心规则的确定性，再堆玩法。
- 所有新机制必须能通过日志、测试或可视化被验证。

如果用户没有明确要求，不要擅自扩展大玩法。

## 3. 当前目录边界

```text
index.html              浏览器沙盒入口，只负责页面结构、CSS、模块装配
src/core/               纯战斗核心，不依赖 DOM / Canvas / window / document
src/data/               默认战斗配置与 actor 装配
src/ui/                 浏览器输入、Canvas 渲染、Debug 面板、Sandbox App
src/dev/                纯逻辑验证工具：scenario runner、trace recorder、内置 scenarios
tests/                  Node 可重复测试
docs/                   架构、战斗模型、验证计划、路线图
tools/serve.py          本地静态服务器
```

### 3.1 `src/core/`

`src/core` 是核心逻辑层。禁止依赖：

- DOM
- Canvas
- `window`
- `document`
- 浏览器事件
- CSS
- 渲染细节
- 具体 UI 控件

可以包含：

- 动作时间轴。
- 状态机。
- 输入意图结构。
- 输入缓冲。
- 武技充能。
- 事件日志。
- 战斗规则。
- 小型数学工具。

核心原则：

```text
输入只表达意图，不直接改变战斗状态。
状态机决定当前动作能否响应输入。
动作阶段决定能否取消。
事件日志记录所有关键结果。
```

### 3.2 `src/data/`

`src/data` 存放默认数值与装配逻辑。默认数值应尽量集中管理，不要散落在 UI 或测试中。

当前默认值：

```text
AA1: startup 18f, active 2f, recovery 24f, damage 10, charge +1
AA2: startup 22f, active 2f, recovery 28f, damage 14, charge +1
AA3: startup 30f, active 2f, recovery 36f, damage 24, charge +2
Art1: startup 15f, active 4f, recovery 28f, damage 40, maxCharge 2, effect Break, special +25
Art2: startup 15f, active 4f, recovery 28f, damage 50, maxCharge 3, effect Topple, special +25
Art3: startup 15f, active 4f, recovery 28f, damage 60, maxCharge 4, effect Launch, special +30
Art4: startup 15f, active 4f, recovery 28f, damage 80, maxCharge 4, effect Smash, special +40
Special Gauge: thresholds 100/200/300, max 300
Specials:
  FireLv1: startup 20f, active 4f, recovery 36f, damage 120, element Fire, level 1
  WaterLv2: startup 22f, active 4f, recovery 38f, damage 180, element Water, level 2
  FireLv3: startup 24f, active 5f, recovery 40f, damage 240, element Fire, level 3
Blade Combo Route:
  FireWaterFire: duration 240f, steps Fire(L1)->Water(L2)->Fire(L3), token FireToken
Routine（套路球 MVP）:
  FireRoutine: Art1->FireSkill1(L1), Art2->FireSkill2(L2), Art3->FireSkill3(L3)
  Tiles: max 3
  Orb: created when last 3 tiles share routineId; totalLayer = sum(layers)
  Orb Break: element Fire, damage = totalLayer*20, apply Burn
  Burn: 300f duration, 60f tick, 5 damage/tick
Input Buffer: 10f
Cancel Bonus: 15f
Cancel Bonus Multiplier: 1.2x
FPS: 60
```

如需调整这些值，必须说明调整原因，并确认测试或手感验证结果。

### 3.3 `src/ui/`

`src/ui` 只负责浏览器壳：

- 键盘输入转为 `CombatInputFrame`。
- Canvas 绘制。
- Debug 面板。
- 调参 UI。
- 固定帧循环驱动。

`src/ui` 可以读取 core 状态并展示，但不应该决定战斗规则。

错误示例：

```text
在 UI 里判断 Recovery 能否取消到 Art。
```

正确示例：

```text
UI 调用 actor.tick(input)，然后根据 actor 状态和事件日志显示结果。
```

## 4. 必须保持的核心规则

### 4.1 输入规则

- 移动是持续输入意图。
- 武技是瞬时输入，进入短输入缓冲。
- 输入不直接改变战斗结果。
- 所有输入是否生效，由状态机和当前动作阶段决定。

### 4.2 动作阶段

每个动作使用统一阶段：

```text
Startup -> Active -> Recovery -> Finished
```

规则：

- `Startup`：普通移动和武技输入不能软取消。
- `Active`：触发命中、伤害、武技充能。
- `Recovery`：允许按动作配置取消到移动或 ready 武技。
- `Finished`：自然结束并进入下一步。

### 4.3 普攻规则

- 角色有目标且在普攻范围内，且没有移动意图时，才可以启动普攻。
- 普攻链为 `AA1 -> AA2 -> AA3`。
- 普攻命中才给武技充能。
- 普攻后摇移动取消后，普攻链重置到 `AA1`。
- 命中收益已经发生后，不能因为移动取消而回滚。

### 4.4 武技规则

- 武技 `charge >= maxCharge` 时 ready。
- 使用武技会消耗 charge。
- 普攻 Recovery 中使用 ready 武技，可以取消后摇。
- Cancel Bonus 窗口内取消到武技，获得伤害奖励。
- Recovery Cancel 和 Cancel Bonus 是两个不同概念，禁止混成一个判断。

### 4.5 事件日志

任何重要战斗行为都必须有可观察事件。

应记录：

- 输入进入缓冲。
- 输入被消费。
- 动作开始。
- 动作阶段变化。
- 命中。
- whiff。
- 武技充能变化。
- 武技 ready。
- 后摇取消到移动。
- 后摇取消到武技。
- Cancel Bonus 生效。
- 动作结束。
- Driver Combo 推进/刷新/失败/过期/完成。
- Special 充能变化/ready/消费/施放失败/命中。
- Blade Combo 开始/推进/失败/过期/完成。
- Token 产出（创建）。

### 4.6 Driver Combo 规则（V2）

Driver Combo 是一层“控制链”验证机制，通过 Art 命中效果推进：

- stage：`None / Break / Topple / Launch`，每个阶段有倒计时（framesLeft）。
- 仅在 Art 命中时推进；whiff 不推进（必须能从事件日志观察）。
- 推进顺序：`Break -> Topple -> Launch -> Smash`。
- `Smash` 为完成效果：触发后立即结束并回到 `None`。
- `Break` 阶段再次命中 `Break` 会刷新倒计时（容错验证）。
- 错序输入产出 `DriverComboFailed`，且不推进 stage（可通过日志/面板证明）。
- 倒计时归零产出 `DriverComboExpired`，stage 回到 `None`。

## 5. 开发流程

任何非微小修改都必须按以下流程：

```text
SPEC -> PLAN -> DO -> VERIFY -> REPORT
```

### 5.1 SPEC

先明确：

- 要解决的问题。
- 不解决的问题。
- 成功标准。
- 不能破坏的既有规则。

进入新玩法版本前，必须先检查并补齐（作为 SPEC 的前置审计清单）：

- docs/system-map.md
- docs/combat-model.md
- docs/mechanics-map.md
- docs/event-catalog.md
- docs/test-coverage-map.md
- docs/validation-plan.md
- docs/roadmap.md
- docs/routine-orb-system.md
- docs/v3-readiness-review.md
- docs/v4-readiness-review.md
- docs/v5-backpack-blade-index.md
- docs/beast-blade-archetype-design.md
- docs/blade-bond-system-design.md
- docs/beast-blade-life-skills-design.md
- docs/v5.2-beast-blade-archetype-spec.md

进入 V4 前额外要求：

- 必须先阅读并更新 `docs/v4-readiness-review.md`，以其作为“未来 payoff 机制”的唯一入口文档。
- V4 必须拆分：先做 V4.0（文档/事件目录/测试与 scenario 计划/可观察性验收口径），再进入 V4.1+ 的最小原型；禁止把“大玩法落地 + 工程扩张”塞进同一个里程碑。

### 5.2 PLAN

再列出：

- 要改哪些文件。
- 每个文件为什么改。
- 测试怎么验证。
- 风险点是什么。

### 5.3 DO

实现时要求：

- 小步提交。
- 不做无关重构。
- 不引入未批准依赖。
- 不扩大任务范围。

### 5.4 VERIFY

至少执行：

```bash
npm test
```

如修改浏览器沙盒，还要手动验证：

```bash
npm start
# 打开 http://127.0.0.1:8000/index.html
```

V2.1 起，优先使用“确定性日志验证”作为主验收证据：

- Node：`npm test` 内包含 scenario runner 与 driver combo scenarios。
- Browser：右侧面板 `Scenario` 区块提供一键 Run 按钮，返回 PASS/FAIL + proof 摘要（不依赖键盘焦点）。
- manual keyboard playtest 仅补充（手感/直觉验证），不作为唯一验收证据。

手动验证至少覆盖：

- 站定进入普攻。
- 持续移动不启动普攻。
- Startup 中移动不取消。
- Active 命中充能。
- Recovery 移动取消。
- Recovery ready Art 取消。
- Cancel Bonus 窗口内生效。
- Art1 命中进入 Break，并显示倒计时。
- Break 阶段再次 Art1 命中会刷新倒计时。
- 按 `1 -> 2 -> 3 -> 4` 顺序命中可完成 Smash，完成后 stage 回到 None。
- 错序 effect 产出失败事件，stage 不推进。
- 等待倒计时归零会过期回 None。
- Special Gauge：武技命中会累积 charge，并在跨过阈值时产出 ready 事件。
- Special：不足等级会失败；足够等级会消费并命中结算。
- Blade Combo：按默认路线 Fire(L1)->Water(L2)->Fire(L3) 命中可完成并产出 TokenCreated。

### 5.5 REPORT

最终回复必须包含：

- 修改文件列表。
- 关键行为变化。
- 测试结果。
- 是否已推送。
- commit / branch / PR 链接。
- 遗留风险。

## 6. Git 工作流

默认不要直接在 `main` 做大改。推荐：

```bash
git checkout main
git pull
git checkout -b <task-branch>
# implement
git test / npm test
git push -u origin <task-branch>
# open PR
```

只有用户明确要求直接提交到 `main` 时，才允许直接修改 `main`。

提交信息应清楚说明目的，例如：

```text
V1.1 add combat snapshot API
V2 add driver combo status model
Fix input buffer expiry event
```

## 7. 禁止事项

未经用户明确要求，禁止：

- 引入 React / Vue / Angular。
- 引入 Vite / Webpack / Rollup 等构建系统。
- 引入 TypeScript。
- 引入复杂资源管线。
- 把项目改成完整游戏。
- 添加复杂敌人 AI。
- 添加队友 AI。
- 添加大型美术资产。
- 添加联网、存档、账号、后端服务。
- 把战斗核心写死到 UI。
- 让 `src/core` 依赖 DOM / Canvas。
- 删除现有测试。
- 为了让测试通过而削弱核心规则。
- 在没有说明原因的情况下改变默认数值。

## 8. 当前路线图

### V0：完成

浏览器单文件/原型，验证最小战斗循环。

### V1：完成

模块化重构：

- `src/core` 纯战斗核心。
- `src/data` 默认配置。
- `src/ui` 浏览器验证壳。
- Node 测试。

### V1.1：完成（质量补强）

- 以 `CombatActor.getSnapshot()` 作为 UI 主要读取入口，减少 UI 读取内部字段。
- 调参 UI 通过 `applyConfigPatch` 修改配置，而不是直接改内部值。

### V2：Driver Combo 原型（完成）

实现 Driver Combo（通过 Art 命中推进）：

```text
Break -> Topple -> Launch -> Smash
```

V2 交付物：

- core 层状态模型（stage + framesLeft + tick/apply/advance/refresh/expire/finish）。
- Art 配置 effect（`Break/Topple/Launch/Smash`），并挂载到 Art 命中链路（whiff 不推进）。
- 事件日志覆盖推进/刷新/失败/过期/完成。
- 最小 UI 面板显示 stage 与倒计时；Smash 有显式提示。
- Node 测试覆盖关键不变量（`npm test` 通过）。

### V2.1：Observability Validation Harness（完成）

新增验证工具层（不改玩法，只提升可观察性与确定性）：

- 纯逻辑 scenario runner + trace recorder（不依赖 DOM/Canvas）。
- 内置 full/wrong-order/expire* scenarios，提供 proof + trace tail。
- Debug UI 提供一键 Run 按钮与 Debug Input（不依赖键盘焦点）。
- Node 测试将 scenarios 纳入 `npm test` 主链路。

### V2.1.1：UI polish（完成）

- 修复 Driver Combo Stage/Timer 面板绑定与实时更新。
- Scenario Run 后保持 paused，便于观察画布状态。
- 更新本文件路线图状态，避免误导后续任务。

### V2.2：机制地图 + 系统资产盘点（完成）

新增架构审计与资产盘点文档（不改玩法）：

- system map（工程分层与依赖边界）
- mechanics map（机制清单：输入/状态/事件/测试/扩展点）
- event catalog（CombatEventType 全量目录与 data 字段）
- test coverage map（tests 覆盖矩阵）
- V3 readiness review（Special/Blade Combo 接入点与风险）

### V3：Special / Blade Combo / Token 原型（完成）

- Special Gauge（由 Art 命中充能，等级阈值 100/200/300）。
- Special cast（消费 gauge，命中产出 SpecialHit）。
- Blade Combo（Special 命中推进路线，完成产出 TokenCreated）。
- scenarios/tests/UI 最小可观察性入口（`npm test` + 浏览器 Debug 面板）。

### V3.1：文档同步 + 验收口径对齐（完成）

- README / AGENTS / docs 的路线图、机制图、测试覆盖图、验证计划保持同步。
- 明确 V4 仅允许以 Readiness Review + 拆分计划进入仓库（先文档与可观察性资产，后最小原型）。
- 新增 `docs/v4-readiness-review.md` 作为 V4 预研唯一入口。

### V4.0：Single Driver Routine-Orb MVP（完成）

- Battle / HP / Result：统一扣血通路，支持击杀与 Victory 结束判定（事件可审计）。
- Routine Orb（套路球）最小闭环：tiles/orb/破球/Burn/tick/击杀。
- tests/scenarios/UI：Node 侧 `npm test` 纳入 MVP；浏览器 Debug 面板提供一键 Run 与可视化展示。
- 明确不包含：Chain Attack / Full Burst / Fusion / 复杂 Orbs cash-out。

### V4.1：Enemy Attack Model Design（完成，仅文档）

- enemy attack model / npc ai design / v4.2 spec 作为实现前置的口径资产：
  - `docs/enemy-attack-model.md`
  - `docs/npc-ai-design.md`
  - `docs/v4.2-enemy-attack-mvp-spec.md`
- 明确不做复杂 AI（行为树/寻路/多敌人/队友 AI/仇恨系统）；只保留最小可验证闭环的设计口径。

### V4.2：Enemy Attack MVP（完成）

- core：EnemyStrikeSpec + enemy runtime state；敌方 tick（范围/冷却/时序）与命中/打空；玩家扣血与 Defeat；Driver Combo 控制门禁。
- 可观察性：新增 `EnemyAttack*`、`EnemyControlled`、`PlayerDamageApplied/PlayerHpChanged/PlayerDefeated` 等事件；`getSnapshot()` 扩展 `snapshot.enemy/snapshot.player/snapshot.battle`。
- tests/scenarios/UI：Node 侧 `npm test` 纳入 enemy-attack tests/scenarios；浏览器 Debug 面板提供 Enemy/Player 区块与 enemy attack scenarios 一键 Run。

### V4.3+：Chain Attack / Orbs cash-out / Full Burst / Fusion（未来，必须拆分）

- 只允许在 Readiness Review + 拆分计划通过后进入实现（见 `docs/v4-readiness-review.md`）。
- 必须先落 "文档与验收资产"，再落 "最小原型"，再补 "工具与可视化"。

### V5.0：Backpack Blade Design（完成）

- 设计文档：`docs/v5-backpack-blade-index.md`、`docs/backpack-loadout-design.md`、`docs/blade-nested-socket-design.md`、`docs/v5.1-backpack-blade-mvp-spec.md`。

### V5.1：Backpack Blade MVP（完成）

- core：新增 `backpack-grid.js`、`backpack-items.js`、`loadout-resolver.js`、`blade-runtime.js`；9×9 背包 + 嵌套槽位 + 异刃自动攻击。
- 可观察性：新增 11 个 Blade/Backpack 事件；`getSnapshot()` 扩展。
- tests/scenarios/UI：Node 侧 `npm test` 纳入 4 个新测试文件；浏览器 Debug 面板提供 Backpack/Blades 区块与一键 Run。

### V5.2：Beast Blade Archetype Design（完成，仅文档）

- 纯设计文档里程碑，不实现代码。
- 交付物：
  - `docs/beast-blade-archetype-design.md`
  - `docs/blade-bond-system-design.md`
  - `docs/beast-blade-life-skills-design.md`
  - `docs/v5.2-beast-blade-archetype-spec.md`
- 明确不做：不写 gameplay code，不改 src/core / src/ui / tests，不实现兽型异刃/羁绊/生活技能代码。

### V5.3：Beast Blade Archetype MVP（完成）

实现兽型异刃的最小原型：

- Species/Lineage/Rarity/IndividualTrait/HiddenStatProfile 系统（`src/core/beast-blade.js`）
- LifeSkills 数据模型（`src/core/life-skills.js`，不消费）
- 4 种 Beast Blade 物品（GreyWolf/MoonWolf/BrownBear/BengalTiger）
- Wolf/Bear/Tiger 三种物种表现差异（damageMultiplier/cooldownMultiplier 影响 BladeRuntime）
- Fierce trait 伤害加成 + BladeTraitActivated 事件
- 新增 2 个 CombatEventType（BladeSpeciesResolved/BladeTraitActivated）
- 新增 3 个测试文件（archetype 17 + runtime 8 + scenario 6）+ 6 个 scenarios
- Debug Panel 展示 species/lineage/rarity/trait/element/lifeSkills/hiddenProfile
- Canvas 显示物种简写（Wolf/Bear/Tiger）
- 明确不做：Bond runtime / Life Skill gameplay / Chain Attack / Full Burst / Fusion Combo

### V5.4：Bond System MVP（完成）

实现羁绊三维的最小原型：

- Trust / Mood / Sync 三维数据模型
- BladeAttackHit 增加 Sync / Trust
- Sync 达阈值触发 BondSyncTriggered
- Victory 增加 Trust / Mood（参与 blades）
- Defeat 降低 Mood（Trust 不变）
- Loyal / Proud trait 对 Bond 有可测影响
- Debug Panel / Canvas / scenarios 可观察
- 新增 4 个 Bond 事件、6 个 scenarios、3 个测试文件

明确不做：送礼/喂食/羁绊剧情/多异刃好感竞争/异刃离队/Life Skill gameplay/采集/狩猎/挖矿/Chain Attack/Full Burst/Fusion Combo

### V5.5.2：Trait Combat Payoff MVP（完成）

实现个体特质战斗兑现最小原型：

- Fierce（凶暴）+ BondCombatSlot1：BladeAttackHit 后追加 FierceFollowUp（额外 15% 伤害）
- Loyal（忠诚）+ BondCombatSlot1：EnemyAttackHit 前降低玩家所受伤害 15%
- Proud（孤傲）+ BondCombatSlot1：BondSyncTriggered 后追加 ProudSyncStrike（额外 10% 伤害）
- 新增 `src/core/trait-combat-payoff.js`（纯函数模块）
- 新增 CombatEventType `TraitPayoffActivated`
- 新增 2 个测试文件 + 4 个 scenarios
- DebugPanel 显示 "Last Trait Payoff"

明确不做：完整技能系统/技能装备 UI/socket UI/Life Skill gameplay/Chain Attack/Full Burst/Fusion Combo

### 明确不做（当前版本边界：<= V5.5.2）

- Chain Attack / Full Burst / Fusion（当前不做；如未来进入 V4.x/V5.x，必须按 Readiness Review 拆分里程碑推进）。
- 复杂属性球系统与连锁兑现（当前仅实现 Routine Orb 最小闭环）。
- Token cash-out（当前仅产出 token，用于延迟奖励输入验证；兑现/破碎/消耗等 payoff 机制需等待未来评审）。
- 敌人复杂 AI（行为树/寻路/追击/多敌人/队友 AI/完整 Aggro 仇恨系统）。
- 背包拖拽 UI / 物品旋转 / Blade 独立寻路 / Blade 复杂 AI。

### 制作人验收结论（截至 V2.1）

- V2 core：通过
- V2 tests：通过结构检查
- V2 UI 基础：基本通过
- V2.1 scenario harness：通过
- V2.1 trace/proof：通过
- main 合并状态：通过

## 9. 新机制接入规则

任何新机制必须回答：

```text
它挂在哪个事件后面？
它改变哪个状态？
它是否产生新事件？
它是否需要 UI 可视化？
它的测试用例是什么？
它是否破坏 V1 既有规则？
```

示例：Driver Combo 不应该直接散落在 UI 里，应该挂在 core 的 Art hit / effect 处理链上。

## 10. 验收标准

修改完成后，至少满足：

- `npm test` 通过。
- `npm run audit:map` PASS。
- `index.html` 可运行。
- `src/core` 不依赖 DOM / Canvas。
- 关键行为可通过事件日志观察。
- 文档同步更新。
- 没有无关功能扩张。

如果无法完成其中任何一项，必须明确报告，不要假装完成。

## 11. 给本地模型的简短执行口令

开始任务前，先重复检查：

```text
我是否在改正确层级？
我是否保持 src/core 纯逻辑？
我是否没有扩大玩法范围？
我是否补了测试？
我是否更新了文档？
我是否能用事件日志证明行为？
```

如果答案不是全部为“是”，先停下修正计划。
