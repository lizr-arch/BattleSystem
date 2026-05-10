# V2.2 Test Coverage Map

本文档盘点 `tests/*.mjs` 的覆盖范围，用于回答：

- 当前哪些机制已有确定性测试证据？
- 哪些事件被断言过？
- V3 开发时哪些测试必须保持通过（保护性不变量）？

## tests/combat-timing-smoke.test.mjs

- 测试目标：验证动作时间轴 `phaseAt(elapsedFrames)` 的分段边界是确定且符合配置帧数。
- 覆盖机制：Action Timeline
- 覆盖事件：无（纯函数边界测试）
- 关键断言：
  - `startupFrames=18, activeFrames=2, recoveryFrames=24` 时：
    - `phaseAt(0..17)=Startup`
    - `phaseAt(18..19)=Active`
    - `phaseAt(20..43)=Recovery`
    - `phaseAt(44)=Finished`
- 没覆盖的风险：
  - 不覆盖 `CombatActionInstance.shouldFireHit()` 的“一次性命中触发”行为。
  - 不覆盖 canCancelToMovement/Art 与 phase 的组合边界。
- V3 必须保持通过的原因：
  - V3 新动作（special）也会复用时间轴；phase 边界是所有机制的基础不变量。

## tests/combat-core.test.mjs

- 测试目标：验证核心闭环的关键规则：普攻启动条件、startup 不可软取消、命中充能、recovery cancel、cancel bonus 触发与伤害倍率。
- 覆盖机制：
  - Input Intent
  - Action Timeline
  - Auto Attack Chain（启动与相位推进的关键路径）
  - Art Charge / Ready / Consume
  - Input Buffer（通过 artSlotsPressed 写入与消费的路径）
  - Recovery Cancel
  - Cancel Bonus
  - Event Log（通过 findEvent 验证）
- 覆盖事件（显式断言/计数）：
  - `ActionStarted`（移动时断言 0 次）
  - `ActionHit`（AA1 命中；Art1 命中含 canceled=true）
  - `ArtChargeChanged`（Art1/2/3/4）
  - `ArtBecameReady`（Art1）
  - `RecoveryCanceledToMovement`
  - `RecoveryCanceledToArt`
  - `CancelBonusApplied`
- 关键断言（保护性不变量）：
  - 站定且在普攻范围内：首帧进入 `state=AutoAttack` 且 `action=AA1`。
  - 持续移动意图：不启动普攻，`state=Locomotion`，且没有 `ActionStarted`。
  - `Startup` 阶段：移动意图不会软取消（位置不变，仍在 AutoAttack/Startup）。
  - 普攻命中：产生 `ActionHit(AA1)`，且所有 arts charge 增加（并发出对应 `ArtChargeChanged`）。
  - `Recovery` 阶段：移动取消到 Locomotion，产生 `RecoveryCanceledToMovement`，且命中收益不回滚（charge 保持）。
  - `Startup` 阶段按 art：不会出现 `RecoveryCanceledToArt`。
  - Cancel Bonus：在窗口内从普攻 Recovery 取消到 Art1，产生 `RecoveryCanceledToArt + CancelBonusApplied`，且 Art1 命中伤害倍率生效（40*1.2=48，`ActionHit` data 带 `canceled:true`）。
- 没覆盖的风险：
  - 未覆盖 `AutoAttackChainAdvanced/Reset` 事件的精确发生时机与次数。
  - 未覆盖 `InputExpired/InputConsumed/InputBuffered` 的显式断言（目前属间接覆盖）。
- V3 必须保持通过的原因：
  - 这是 V1/V2 的核心规则集合；任何 V3 扩展都不能破坏这条闭环的确定性与可解释性。

## tests/ui-module-load.test.mjs

- 测试目标：确保浏览器入口 `index.html` 的 ESM 装配仍可被 Node 解析/动态 import（防止入口路径或导出被破坏）。
- 覆盖机制：Browser Debug UI（模块装配入口）
- 覆盖事件：无
- 关键断言：
  - `index.html` 中存在 `import { startSandboxApp } from '.../src/ui/sandbox-app.js'`
  - 动态 import 后 `startSandboxApp` 是函数
- 没覆盖的风险：
  - 不覆盖浏览器实际运行（canvas 渲染/DOM 交互），仅保证模块形态。
- V3 必须保持通过的原因：
  - 仓库定位是“浏览器优先原型”；入口装配不能被破坏。

## tests/driver-combo.test.mjs

- 测试目标：验证 DriverComboState 的规则不变量与 formatCombatEvent 文本；并验证“Art 命中才推进，whiff 不推进”。
- 覆盖机制：
  - Driver Combo
  - Event Log（formatCombatEvent）
  - Arts（Art 命中路径与 range whiff）
- 覆盖事件（显式断言）：
  - `DriverComboApplied`
  - `DriverComboAdvanced`
  - `DriverComboRefreshed`
  - `DriverComboFailed`
  - `DriverComboExpired`
  - `DriverComboFinished`
  - `ActionWhiffed`（Art1 whiff）
- 关键断言（保护性不变量）：
  - tick 到 0 必须 `DriverComboExpired` 且状态回 None。
  - `Break` 只能应用到 stage None；错序必须 `DriverComboFailed` 且不改变 stage。
  - `Break` 阶段再 Break 必须刷新。
  - `Break->Topple->Launch` 正确推进；`Launch+Smash` 完成并回 None。
  - Art1 whiff 后不应出现任何 DriverCombo* 事件。
- 没覆盖的风险：
  - 不覆盖 UI 面板绑定与显示正确性（属于 UI/可视化层）。
- V3 必须保持通过的原因：
  - V3 Blade Combo 必须与 Driver Combo 并行存在；Driver Combo 的不变量不能被新机制破坏或耦合覆盖。

## tests/scenario-runner.test.mjs

- 测试目标：验证 scenario runner 的 PASS/FAIL 结果结构、proof/trace 生成，以及 console 输出的可读性。
- 覆盖机制：Scenario Runner、Trace Recorder（间接）
- 覆盖事件：无（runner 自测不依赖特定 CombatEventType）
- 关键断言：
  - fail-fast：`assertSnapshot(() => false)` 返回 `passed=false` 且 `failedStep.label` 正确；trace 为数组；console 输出包含 `Scenario FAIL` 与 tail。
  - happy path：`waitFrames + assertSnapshot` 返回 `passed=true` 且 proof 包含指定 label；console 输出包含步骤名。
- 没覆盖的风险：
  - 不覆盖 trace 的“增量事件 head 指针”正确性（目前依赖 eventLog.events[0] 语义）。
- V3 必须保持通过的原因：
  - V3 的主验收建议继续以 scenarios 驱动；runner 是工具链核心资产。

## tests/driver-combo-scenario.test.mjs

- 测试目标：跑内置 scenarios，验证 runner + driver combo + debug grant ready 的端到端链路（纯逻辑、确定性）。
- 覆盖机制：
  - Scenario Runner（steps + prepare）
  - Driver Combo（Applied/Advanced/Failed/Expired/Finished）
  - DebugGrantArtsReady（用于场景准备）
  - Snapshot API（finalSnapshot 断言 stage None）
- 覆盖事件（显式断言）：
  - `DebugGrantArtsReady`
  - `DriverComboApplied`
  - `DriverComboAdvanced`
  - `DriverComboFailed`
  - `DriverComboExpired`
  - `DriverComboFinished`
- 关键断言（保护性不变量）：
  - full-driver-combo：按 1-2-3-4 命中应完成 Smash 且最终 stage None。
  - wrong-order-smash：错序 smash 必须失败且 stage 不推进。
  - expire-break / expire-topple：倒计时归零必须过期回 None。
- 没覆盖的风险：
  - 不覆盖“键盘焦点/浏览器 one-shot”问题（已由 V2.1 通过 Debug UI 按钮规避，Node 侧保持确定性验证）。
- V3 必须保持通过的原因：
  - 这是“机制链路验收”模板；V3 应补齐同级别 scenarios（happy/wrong-order/expire），并保持现有场景不退化。

