# V2.2 V3 Readiness Review

本文档只做 readiness review（接入点与风险评估），不实现 V3 任何玩法与数值改动。

## 1. V3 可能目标

在 BattleSystem 的“机制验证”定位下，V3 的合理目标应保持最小闭环、可解释、可审计：

- Special：一条可充能、可 ready、可消费的“资源条”，由现有战斗行为驱动（普攻/武技/取消/Driver Combo 等候选点）。
- Blade Combo：一条“元素路线链”（route chain），由 Specials 命中推进，成功后产出可延迟兑现的 token/orb（用于未来 V4 cash-out）。
- 验证优先级：事件日志 + scenarios（Node deterministic）为主，浏览器 UI 可视化为辅。

明确不在 V3 做的事（保持最小范围）：

- 不做 Chain Attack（留给 V4）。
- 不做复杂 AI/多角色/联网/存档。
- 不把路线/表演写死到 UI。

## 2. 应该复用哪些现有机制

V3 的实现建议最大化复用现有“可观察性链路”：

- Art hit / ActionHit：已有“命中/whiff”的明确事件与 data 字段，可作为充能/推进的挂载点候选。
- Event Log：所有关键决策都必须变成事件（便于审计与 UI 展示）。
- Snapshot API：任何需要 UI/trace/scenario 读取的状态，都应进入 snapshot。
- Scenario Runner：用 steps 驱动并用 `assertEvent/assertSnapshot` 写机制验收场景。
- Trace Recorder：FAIL 时给出 trace tail，缩短 debug 路径。
- Browser Debug UI：只做“展示 snapshot + 一键跑 scenarios + debug 注入”，不实现玩法规则。
- Default config：所有默认数值与路线表应集中在 `src/data/`，避免散落。

## 3. Special Gauge 应该挂在哪里？

当前系统里“可挂载的稳定节点”主要来自 core 的两类地方：

- 命中结算：`onAutoAttackHit` / `onArtHit`（对应 `ActionHit/ActionWhiffed`）。
- 机制结果事件：`CancelBonusApplied`、`DriverCombo*`。

候选点分析（只做设计判断，不实现）：

- AutoAttackHit 后充能？
  - 优点：与现有“普攻命中充能 arts”一致，稳定、频繁、可预期；容易写 scenarios 验证。
  - 风险：若 V3 special 主要依赖 arts/取消节奏，单靠普攻可能导致节奏偏慢或过快（需要通过数据调参而不是改规则）。
  - 建议：作为主充能来源之一，且必须是“命中才加”（与 arts 一致）。
- ArtHit 后充能？
  - 优点：奖励主动消费与命中，符合“用招推进”的验证目标。
  - 风险：与 cancel bonus/driver combo 的耦合可能被误用（例如把特殊规则写进 UI）。
  - 建议：可作为次充能来源（或只在特定 art/special 类型上配置）。
- Cancel Bonus 后额外充能？
  - 优点：强化“节奏好”得到额外收益，验证取消体系的意义。
  - 风险：容易把 “Recovery Cancel 与 Cancel Bonus” 混成一个概念；也可能导致过度奖励，掩盖基础节奏问题。
  - 建议：可以做成“可配置的额外加成”（事件挂载在 `CancelBonusApplied` 之后），但必须保持概念分离并有 tests/scenarios。
- Driver Combo 推进后额外充能？
  - 优点：鼓励控制链完成；可作为大额奖励，便于验证“完成链的 payoff”。
  - 风险：Driver Combo 是控制链，Blade Combo 是路线链；若在此加成过重，会导致两条链相互绑死。
  - 建议：若使用，建议只在 `DriverComboFinished(Smash)` 作为“完成奖励”挂载，且通过独立事件/状态记录，避免与路线耦合。

推荐结论（作为 V3 SPEC 的默认建议）：

- SpecialGauge 的核心增量挂载在 “命中结算”（普攻命中 + 可选的武技命中）。
- “CancelBonusApplied/DriverComboFinished” 只能作为可选加成点，并在事件层清晰表达（不在 UI 特判）。

## 4. Blade Combo Route 应该归谁拥有？

候选 ownership 分析：

- CombatActor 拥有？
  - 优点：与 DriverComboState、Arts、输入/动作状态一致；当前仓库单 actor 原型更自然。
  - 风险：未来多 actor 时需要外移到更高层（BattleContext），但可以后续演进。
- Target/Dummy 拥有？
  - 优点：如果路线被设计成“附着在敌人身上”的 debuff/route，也有合理性。
  - 风险：当前 target 只是简单对象（无专门状态类）；贸然把路线塞进 target 会引入新结构与迁移成本。
- 独立 subsystem 拥有（类似 DriverComboState）？
  - 优点：机制隔离清晰；可独立建模、独立事件、独立 tests/scenarios。
  - 风险：需要决定 subsystem 挂在 actor 还是更高层。

建议：

- V3 的 BladeComboRouteState 采用“独立 subsystem + 挂在 CombatActor 上”的方式（与 DriverComboState 对齐）。
- route 只表达“路线阶段/剩余帧数/最近命中的 special/元素”，并以事件对外可观察。

## 5. 属性 token / orb 未来怎么接？

设计判断（只描述接法，不实现）：

- Blade Combo 成功后创建 token：
  - 产物应是一个显式可观察状态（例如 tokens 列表）与对应事件（例如 `BladeComboTokenCreated`）。
  - token 必须能被 future V4 的 cash-out 消费（需要稳定 id/element/type）。
- token 挂在 target 还是 actor？
  - 从 Xenoblade2 语义看，“orb 附着在敌人身上，Chain Attack 消费敌人 orbs”更直观。
  - 但当前 target 结构过轻；建议未来引入“target runtime state”（例如 `CombatTargetState` 或把 target 改为 class），再把 tokens 挂上去。
  - 若短期不想改 target 结构，也可以先挂在 actor 上，但要在文档明确这是临时建模，且 future 迁移成本可控。
- Chain Attack 未来如何消费 token？
  - token 应该是被动资产，不应在 UI 里直接清除。
  - V4 需要一个“消费入口事件”（例如 ChainAttackHit/TokenShattered），用 scenarios 验证 cash-out 规则。

建议：

- V3 可以先定义 tokens 的数据模型与 snapshot 读接口的形态（设计层），但实现时应尽量把 token 作为“target-owned”的方向保留。

## 6. 与 Driver Combo 的关系

- Driver Combo：控制链（Break/Topple/Launch/Smash），由 Arts 命中推进。
- Blade Combo：元素/路线链，由 Specials 命中推进。
- 两者应并行存在，不互相覆盖状态，也不共享同一 stage 字段。
- 未来 Fusion Combo 才是“读取两者状态并产出额外 payoff”的机制；V3 不应提前耦合。

建议的结构对齐：

- `DriverComboState`（已存在）与 `BladeComboState`（未来）都应：
  - 有明确的 `apply(...)` 与 `tick(...)`；
  - 产出事件对象（type+data），由 actor 统一 emit；
  - 有 snapshot 字段用于 UI/trace/scenario。

## 7. V3 风险

必须提前规避的风险点（在 V3 SPEC 与 code review 中作为 checklist）：

- 把 Special / Blade Combo 写死到 UI（例如按钮逻辑直接推进路线）。
- 事件命名混乱（Special/Blade 与 DriverCombo 事件混用或字段含义不清）。
- 与 Driver Combo 状态耦合过重（例如 Blade 读取 Driver stage 作为推进条件）。
- route 数据硬编码在 core（没有集中在 `src/data/`，或没有可替换配置入口）。
- 测试只测 UI 不测 core（缺少 Node deterministic scenarios）。
- 过早做 Chain Attack（破坏“最小闭环验证”的范围控制）。

## 8. V3 SPEC 草案（下一任务草案，不在本 PR 实现）

这是一个可执行的 V3 SPEC 草案，用于下一任务开工时直接展开（本 PR 不实现）。

- 问题：缺少 Special 与 Blade Combo 的最小原型验证路径；无法在现有 harness 上审计“special 充能/路线推进/token 产出”。
- 不解决的问题：Chain Attack、复杂 AI、多角色、完整元素系统、UI 表现升级。
- 成功标准：
  - core：新增 SpecialGaugeState 与 BladeComboState（或等价结构），具备 tick/apply 与事件产出。
  - data：新增默认 Special/Blade 配置（充能规则、路线表、持续帧数等），不散落在 UI/tests。
  - events：新增与 Special/Blade 相关的可观察事件（充能变化、ready、消费、路线推进、失败/过期、token 创建）。
  - snapshot：新增 `specialGauge`、`bladeCombo`、（可选）`tokens` 字段供 UI/trace 使用。
  - dev：新增 scenarios：happy route / wrong order / expire / token created；全部纳入 `npm test`。
  - ui：仅新增展示字段与一键 Run 按钮（不写规则）。
- 保护性不变量（必须保持）：
  - `src/core` 不依赖 DOM/Canvas/window/document。
  - V1/V2 既有普攻/武技/取消/Driver Combo 规则不变；既有 tests 与 scenarios 必须保持通过。
  - Recovery Cancel 与 Cancel Bonus 概念分离。
  - Art whiff 不推进 Driver Combo（同理：Special whiff 不推进 Blade Combo）。

