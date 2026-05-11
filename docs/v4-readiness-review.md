# V4 Readiness Review（Chain Attack / Orbs / Full Burst / Fusion）

本文件是 V4 的唯一入口文档，用于把未来可能引入的 payoff 机制拆成“可观察、可测试、可分阶段落地”的 readiness 计划。本文不包含任何玩法实现，也不承诺一定会进入 V4。

前置共识（与 V3.1 口径一致）：

- 本仓库当前闭环只做到 Token 产出，不做兑现。
- V4.0 阶段只允许补齐文档、事件目录草案、tests/scenarios 计划与可观察性验收口径。
- 任何未来玩法若落地，仍必须保持 `src/core` 纯逻辑，且关键决策可由事件日志与 scenarios 解释（proof + trace tail）。

## 1 当前 Token 是什么？

当前 Token 仅用于“延迟奖励输入验证”，不是属性球，也不是 Chain Attack 的实现替代品。

- 产出来源：Blade Combo 路线完成会创建 1 个 Token，并记录 `TokenCreated`。
- 当前语义：Token 代表“某条路线完成后的可观察产物”，用于证明 payoff 输入已被触发；不包含兑现/消耗/破坏等玩法。
- 可观察性：Token 的创建应能通过事件日志、actor snapshot、scenario proof 被稳定复现与断言。
- 边界：当前版本（<= V3.1）不引入 Token cash-out；V4 只讨论“若未来要用 Token 作为进入条件/计数资源，应如何拆解与验证”。

## 2 Chain Attack 未来应该是什么？

在本仓库的定位下，Chain Attack 应首先被定义为“可审计的轮次状态机”，而不是一段只能靠 UI/手感验证的大招演出。

- 目标形态：独立 `ChainAttackState`，通过明确的进入/推进/结束/失败分支驱动，所有分支均产出事件。
- 进入条件：只允许来自可枚举的资源/状态（示例候选：存在至少 1 个 orb；或 Token 计数满足；或 debug/scenario 显式 grant）。进入条件必须可被事件证明。
- 轮次结构：每一轮至少拆成“轮次开始 → 选择/输入 → 结算（命中或失败）→ 是否继续/结束”，并记录原因（insufficient / wrong order / expired / user stop）。
- 与既有架构关系：
  - 不绕开 action timeline：Chain Attack 内的结算仍应复用“动作 → 命中/打空 → 事件”的可观察模型。
  - 不由 UI 特判：UI 只展示 state 与事件，不决定是否允许继续/结束。

候选状态形状（非最终 API）：

- `ChainAttackState`：`active:boolean`、`round:number`、`step:string`、`framesLeft:number`、`reason?:string`

候选事件草案（命名仅作草案，最终以 `CombatEventType` 风格为准）：

- `ChainAttackStarted`（reason）
- `ChainAttackRoundStarted`（round）
- `ChainAttackSelection`（round/choice）
- `ChainAttackHit`（round/result）
- `ChainAttackEnded`（reason）

最小可验证闭环（V4.1 只能选其一，不做全套）：

- scenarios 能显式进入/退出 chain 状态（不依赖键盘焦点）。
- 至少 1 轮可产生“选择 → 结算 → 继续或结束”的完整事件链，并带有可断言的失败原因分支。

## 3 属性球破坏未来怎么设计？

本节只讨论“破坏（break）”的 readiness 设计，不在 V4.0/V4.1 强行一次性补齐生成、表现与完整数值系统。

建议把“球”视为目标侧的可观察资源列表，并优先把“破坏”做成可审计的 stacks 变化，而不是一刀切的黑盒触发。

- 所属：orbs 建议属于 target（更贴近“被挂球/被破坏”的观察模型），并可由 snapshot 展示。
- 基本字段（示例形状）：`element`、`stacks`、`createdFrame`、`ttlFrames`、`source`
- 破坏输入：破坏应由可枚举的命中事件驱动（示例候选：某种元素/等级的 Special 命中），并显式记录破坏原因与前后 stacks。
- 失败与过期：破坏输入不满足条件时必须产出可观察失败（而不是静默无事发生）；`ttlFrames` 归零要产出过期事件并清理状态。

候选状态形状（非最终 API）：

- `OrbsState`：`orbs[]`（element/stacks/ttlFrames/createdFrame/owner/source）

候选事件草案：

- `OrbCreated`（element/stacks/ttlFrames/source）
- `OrbStackChanged`（element/before/after/reason）
- `OrbBroken`（element/reason）
- `OrbExpired`

最小可验证闭环（V4.1 友好候选）：

- `orb-create-and-break`：确定性生成 1 个 orb → 可重复触发 stacks 下降 → 破碎 → 事件完整。
- `orb-expire`：生成后等待过期 → 事件完整。

## 4 Full Burst 未来怎么设计？

Full Burst 建议先被定义为“由 orb 破坏统计触发的限时状态”，其主要交付物是可观察的 Started/Finished 事件与可解释的窗口行为，而不是完整的伤害/奖励系统。

- 触发条件：由 orb 破碎满足条件触发（示例候选：所有 orb 被破碎；或破碎次数达到阈值）。触发条件必须可被事件与 snapshot 解释。
- 状态窗口：明确 `framesLeft` 与允许的输入集合；任何限制都必须能通过事件与 snapshot 复盘。
- 结算输出：本仓库更偏向“可观察性验证”，输出应优先定义为事件/Token（而非扩展成完整奖励数值体系）。

候选状态形状（非最终 API）：

- `FullBurstState`：`active:boolean`、`framesLeft:number`、`trigger?:string`

候选事件草案：

- `FullBurstStarted`（trigger）
- `FullBurstFinished`

最小可验证闭环（V4.1 的另一条候选，不与 orb break 同时做）：

- `full-burst-trigger`：在可控场景中满足触发条件 → 进入 full burst → 到期结束 → 事件完整。

## 5 Fusion Combo 未来怎么设计？

在 XB2-like 语境下，“Fusion Combo”更接近“Driver Combo 与 Blade Combo 同时活跃时的叠加状态”。在本仓库中，应把它做成派生状态与事件，而不是在 UI/伤害公式里散落特判。

- 定义：当 Driver Combo 与 Blade Combo 同时满足某种可枚举组合条件时，进入 Fusion Combo 状态；任意一条链结束/过期时退出。
- 接入点：优先挂在“Driver/Blade 状态变更事件后”的派生判定链上，避免系统互相读取内部字段。
- 最小效果表达：先只产出可审计事件（例如 started/ended + kind/source），不在 V4.1 引入复杂数值加成与全局公式修改。

候选状态形状（非最终 API）：

- `FusionState`：`active:boolean`、`kind:string`、`framesLeft:number`、`source:{ driverStage, bladeStage }`

候选事件草案：

- `FusionStarted`（kind/source）
- `FusionEnded`（reason）

最小可验证闭环（V4.1 的另一条候选，不与 chain/full burst 同时做）：

- `fusion-basic`：通过 scenarios 复现“并行活跃 → 达成融合 → 产出事件 → 任一过期后退场”的可解释链路。

## 6 V4 风险

- 概念耦合：Orbs/Chain/FullBurst/Fusion 相互读取内部字段，导致改一处全崩，且难以写出稳定测试。
- 语义污染：把 Token 当成“万能资源”硬塞进所有进入条件，导致后续想引入真实 orbs 时不可迁移。
- 不可观察：只有 UI 展示，没有事件与可断言证据，导致“看起来对但不可复现”。
- 验收不确定：依赖手感/键盘焦点复现，无法在 Node 端稳定重放。
- 过度扩张：为了实现大玩法引入构建系统/大型依赖/复杂资源管线，偏离仓库定位。

## 7 V4 建议拆分

V4 必须拆分推进，且每个阶段的交付物都以“可观察、可测试、可解释”为优先。

不要试图在一个 PR 里一次性做完 V4.0~V4.3；每个阶段至少一个独立 PR（必要时可继续细拆）。

- V4.0 Chain Attack State + Token Consumption
  - 交付重点：`ChainAttackState` 最小状态机 + Token 消耗语义（只做“可观察、可测试”的消耗/不足/失败分支，不做复杂演出与奖励系统）。
  - 强制包含：事件目录增量草案（含字段）、snapshot 字段、scenario proof（PASS/FAIL + proof 摘要 + trace tail）。
- V4.1 Orb Break / Round Extension
  - 交付重点：orb 破坏闭环 + “破坏 → 回合延长/续轮”的最小规则（把延长作为可审计状态变化与事件，不做完整数值体系）。
  - 强制包含：enter/advance/fail/expire/finish 覆盖矩阵与对应 scenarios。
- V4.2 Full Burst
  - 交付重点：由 orb 破坏统计触发的限时状态（Started/Finished + 可解释窗口），并保持与 Chain/Orbs 的低耦合。
  - 强制包含：可重复触发与到期结束的确定性 scenario。
- V4.3 Fusion Combo
  - 交付重点：Driver Combo 与 Blade Combo 并行活跃下的派生融合状态与事件（started/ended + reason/source），避免 UI/伤害公式散落特判。
  - 强制包含：并行活跃→进入融合→退出融合的可解释 trace。
