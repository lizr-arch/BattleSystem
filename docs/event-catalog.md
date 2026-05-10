# V2.2 Event Catalog

本文档列出当前所有 `CombatEventType`，并给出其定义位置、发出位置、触发条件、`data` 字段与日志格式。事件名与字段以代码为准（见 `src/core/enums.js` 与 `src/core/combat-events.js`）。

## 全局约定

- 定义位置：`src/core/enums.js`（`CombatEventType`）。
- 统一发射：`src/core/combat-actor.js` 通过 `actor.emit(type, data)`，最终走到 `src/core/combat-events.js:emitCombatEvent(eventLog, frame, type, data)`。
- 日志存储：`src/core/combat-event-log.js`
  - `event = { frame, type, message, data }`
  - `events` 头部是最新事件（`unshift`）。
- 日志格式（面板/文本）：`eventLog.format(event)` 输出 `F00001  <message>`；`message` 来自 `formatCombatEvent(type, data)`。

## Init

- 定义位置：`src/core/enums.js`（`CombatEventType.Init`）
- 发出位置：`src/core/combat-actor.js`（`constructor`）
- 触发条件：`CombatActor` 创建完成后自动发出一次。
- data 字段：无（`{}`）
- 日志格式：`Init`
- 相关机制：Event Log、Snapshot API（初始化后可读）
- 测试覆盖：间接（大多数 tests 构造 actor 时都会产生该事件，但未断言）
- 备注：用于标记“从无到有”的 actor 生命周期节点。

## Reset

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`resetRuntime`）
- 触发条件：调用 `actor.resetRuntime()`。
- data 字段：无（`{}`）
- 日志格式：`Reset`
- 相关机制：Browser Debug UI（Reset 按钮）、Scenario Runner（prepare 中会 reset）
- 测试覆盖：间接（scenarios 的 prepare 会调用）
- 备注：`resetRuntime({ keepLog:false })` 默认会清空 eventLog 后再 emit Reset。

## InputBuffered

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-input.js`（`CombatCommandBuffer.bufferArt`）
- 触发条件：每帧读取 `CombatInputFrame.artSlotsPressed` 并写入输入缓冲时。
- data 字段：
  - `slot: number`（0-based）
  - `frames: number`（本次写入的 maxFrames）
- 日志格式：`InputBuffered UseArt{slot+1} {frames}f`
- 相关机制：Input Buffer
- 测试覆盖：间接（core 与 scenarios 都会触发缓冲写入，但未对该事件做显式断言）
- 备注：当前缓冲是“最后一次覆盖式写入”，不是队列。

## InputConsumed

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-input.js`（`CombatCommandBuffer.consumeArt`）
- 触发条件：core 成功消费缓冲中的 art 输入（通常是在可释放窗口内）。
- data 字段：
  - `slot: number`（0-based）
- 日志格式：`InputConsumed UseArt{slot+1}`
- 相关机制：Input Buffer、Recovery Cancel
- 测试覆盖：间接（释放 art 时会消费）
- 备注：消费只发生在 core；UI 不应自行消费。

## InputExpired

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-input.js`（`CombatCommandBuffer.tick`）
- 触发条件：输入缓冲剩余帧数归零时。
- data 字段：
  - `slot: number|null`（过期时保存的 slot；实现里会在清空前记录并写入）
- 日志格式：`InputExpired UseArt{slot+1}`
- 相关机制：Input Buffer
- 测试覆盖：间接（当缓冲未被消费且经过足够帧数会触发）
- 备注：format 使用 `slot ?? 0`，若 slot 为 null 会显示 UseArt1（属于展示层容错）。

## DebugGrantArtsReady

- 定义位置：`src/core/enums.js`
- 发出位置：
  - `src/ui/debug-panel.js`（`grantAllArtsReady`）
  - `src/dev/scenarios.js`（`grantAllArtsReady`）
- 触发条件：调试/场景准备阶段强制把所有 arts 的 `charge` 设为 `maxCharge` 并记录一次事件。
- data 字段：以 artId 为 key 的对象映射
  - `<artId>: { charge: number, maxCharge: number }`
- 日志格式：`DebugGrantArtsReady Art1=2/2 Art2=3/3 ...`（按 Object.entries 顺序拼接）
- 相关机制：Browser Debug UI、Scenario Runner（prepare）
- 测试覆盖：`tests/driver-combo-scenario.test.mjs`（断言该事件存在）
- 备注：这是“调试注入”事件，不属于正常玩法；V3 也应保留类似 debug 注入能力用于验证。

## ActionStarted

- 定义位置：`src/core/enums.js`
- 发出位置：
  - `src/core/combat-actor.js`（`startAutoAttack`、`startArt`）
- 触发条件：
  - 普攻启动：进入 `AutoAttack` 并创建 action instance。
  - 武技启动：进入 `Art` 并创建 action instance（在 `ArtConsumed` 之后）。
- data 字段（两种形态）：
  - 普攻：`{ actionId: string }`
  - 武技：`{ artId: string, canceled: boolean }`
- 日志格式：`ActionStarted <actionId|artId>`
- 相关机制：Action Timeline、Auto Attack Chain、Arts
- 测试覆盖：`tests/combat-core.test.mjs`（移动时断言 ActionStarted 数量为 0；其余场景隐式触发）
- 备注：武技启动时的 `canceled` 标记只在 data 中；message 不展示 canceled。

## ActionPhaseChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickCurrentAction`）
- 触发条件：`action.phase` 发生变化时（按 `CombatActionSpec.phaseAt` 判定）。
- data 字段：
  - `actionId: string`
  - `before: string`（ActionPhase）
  - `after: string`（ActionPhase）
- 日志格式：`ActionPhaseChanged <actionId> <before>-><after>`
- 相关机制：Action Timeline
- 测试覆盖：未做显式断言（由 core 行为间接覆盖）
- 备注：当前只对 `this.action.spec.id` 发该事件；武技 actionSpec.id 为 `ArtX_Action`，不是 `ArtX`。

## ActionHit

- 定义位置：`src/core/enums.js`
- 发出位置：
  - `src/core/combat-actor.js`（`onAutoAttackHit`、`onArtHit`）
- 触发条件：
  - 普攻命中：目标在普攻范围内且 hit 触发点到达。
  - 武技命中：目标在武技范围内且 hit 触发点到达。
- data 字段（两种形态）：
  - 普攻：`{ actionId: string, damage: number }`
  - 武技：`{ artId: string, damage: number, canceled: boolean }`
- 日志格式：
  - 普攻：`ActionHit <actionId> damage=<damage>`
  - 武技：`ActionHit <artId> damage=<damage>`（若 `canceled:true` 追加 ` [bonus]`）
- 相关机制：Auto Attack、Arts、Cancel Bonus、Driver Combo（Art 命中后 apply effect）
- 测试覆盖：`tests/combat-core.test.mjs`（AA1 命中；Art1 cancel bonus 命中伤害=48）
- 备注：`canceled` 是“是否从普攻 Recovery 取消到 Art 且仍在 bonus window”的标记，用于伤害倍率与日志标记。

## ActionWhiffed

- 定义位置：`src/core/enums.js`
- 发出位置：
  - `src/core/combat-actor.js`（`onAutoAttackHit`、`onArtHit`）
- 触发条件：hit 触发点到达时，但目标不在对应范围内。
- data 字段：
  - 普攻：`{ actionId: string }`
  - 武技：`{ artId: string }`
- 日志格式：`ActionWhiffed <actionId|artId>`
- 相关机制：Auto Attack、Arts、Driver Combo（whiff 不推进）
- 测试覆盖：`tests/driver-combo.test.mjs`（Art1 whiff 后断言无 DriverCombo*）
- 备注：whiff 不产生充能、不打开 cancel window、不推进 driver combo。

## ActionFinished

- 定义位置：`src/core/enums.js`
- 发出位置：
  - `src/core/combat-actor.js`（`tickAutoAttackState`、`tickArtState`）
- 触发条件：action 进入 `Finished` 相位后，本帧完成收尾与状态切换时。
- data 字段：
  - 普攻：`{ actionId: string }`
  - 武技：`{ artId: string }`
- 日志格式：`ActionFinished <actionId|artId>`
- 相关机制：Action Timeline、Auto Attack Chain、Arts
- 测试覆盖：未做显式断言（由状态机推进间接覆盖）
- 备注：当前“结束事件”发在 action 清空前。

## ArtChargeChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onAutoAttackHit`）
- 触发条件：普攻命中给 arts 增加 charge 且 charge 确实发生变化时。
- data 字段：
  - `artId: string`
  - `before: number`
  - `after: number`
- 日志格式：`ArtChargeChanged <artId> <before>-><after>`
- 相关机制：Art Charge / Ready
- 测试覆盖：`tests/combat-core.test.mjs`（断言 Art1/2/3/4 的 charge changed 事件存在）
- 备注：若 `before===after`（例如已满），不会发该事件。

## ArtBecameReady

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onAutoAttackHit`）
- 触发条件：`Art.addCharge()` 返回 `becameReady:true` 时。
- data 字段：
  - `artId: string`
- 日志格式：`ArtBecameReady <artId>`
- 相关机制：Art Charge / Ready
- 测试覆盖：`tests/combat-core.test.mjs`（等待 Art1 ready 并断言该事件存在）
- 备注：只在“从未 ready → ready”时触发一次。

## ArtConsumed

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`startArt`）
- 触发条件：开始释放武技，并调用 `art.consume()` 后。
- data 字段：
  - `artId: string`
- 日志格式：`ArtConsumed <artId>`
- 相关机制：Art Consume
- 测试覆盖：未做显式断言（释放武技时隐式触发）
- 备注：`art.consume()` 会把 `charge` 清零；但具体数值变化没有单独事件。

## CancelBonusWindowOpened

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onAutoAttackHit`）
- 触发条件：普攻命中后开启 cancel bonus 窗口（`cancelBonusLeft=cancelBonusFrames`）。
- data 字段：
  - `frames: number`
- 日志格式：`CancelBonusWindowOpened <frames>f`
- 相关机制：Cancel Bonus
- 测试覆盖：未做显式断言（但 Cancel Bonus 行为在 combat-core.test 里被验证）
- 备注：窗口在每个 tick 中按帧衰减；归零不产生专门事件（当前版本）。

## CancelBonusApplied

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tryUseBufferedReadyArt`）
- 触发条件：从普攻 Recovery 取消到 Art 且 `cancelBonusLeft > 0` 时。
- data 字段：
  - `artId: string`
- 日志格式：`CancelBonusApplied <artId>`
- 相关机制：Cancel Bonus、Recovery Cancel
- 测试覆盖：`tests/combat-core.test.mjs`（断言该事件存在，并验证命中伤害倍率）
- 备注：该事件表示“奖励判定成立”；实际伤害倍率在 Art 命中时应用。

## RecoveryCanceledToMovement

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickAutoAttackState`）
- 触发条件：普攻 action 在 Recovery 且允许 cancelToMovement，同时 `moveIntent` 为 true。
- data 字段：
  - `actionId: string`（来源普攻动作）
- 日志格式：`RecoveryCanceledToMovement <actionId>`
- 相关机制：Recovery Cancel、Auto Attack Chain
- 测试覆盖：`tests/combat-core.test.mjs`（断言事件存在 + 链重置 + 不回滚充能）
- 备注：取消到移动会清空 `cancelBonusLeft` 并重置普攻链。

## RecoveryCanceledToArt

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tryUseBufferedReadyArt`）
- 触发条件：从普攻 Recovery 成功取消到 ready 的 Art。
- data 字段：
  - `fromActionId: string`（来源普攻动作）
  - `artId: string`（目标武技）
- 日志格式：`RecoveryCanceledToArt <fromActionId> -> <artId>`
- 相关机制：Recovery Cancel、Input Buffer、Cancel Bonus
- 测试覆盖：`tests/combat-core.test.mjs`（Startup 阶段确保不会出现；真正取消到 Art 时断言存在）
- 备注：该事件不表示 bonus，一旦取消发生，会紧接着消费输入并启动武技。

## AutoAttackChainAdvanced

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`advanceAutoAttackChain`）
- 触发条件：普攻 action 自然结束后，推进 `autoAttackIndex` 到下一段。
- data 字段：
  - `nextActionId: string`
- 日志格式：`AutoAttackChainAdvanced -> <nextActionId>`
- 相关机制：Auto Attack Chain
- 测试覆盖：未做显式断言（由普攻循环间接覆盖）
- 备注：推进发生在 `ActionFinished` 之后。

## AutoAttackChainReset

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`resetAutoAttackChain`）
- 触发条件：当链不在 firstIndex 且发生重置时才发出。
- data 字段：无（`{}`）
- 日志格式：`AutoAttackChainReset`
- 相关机制：Auto Attack Chain
- 测试覆盖：未做显式断言（但 Recovery cancel/Art 结束后会触发 reset）
- 备注：用于证明“链被重置过”，避免 silent reset。

## DriverComboApplied

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/driver-combo.js`（`DriverComboState.applyStage`）
  - 实际 emit：`src/core/combat-actor.js`（`onArtHit`，将返回事件转发 emit）
- 触发条件：在 `stage=None` 时，Art 命中并 apply `effect=Break` 成功进入 `stage=Break`。
- data 字段：
  - `stage: string`（DriverComboStage）
  - `duration: number`
  - `framesLeft: number`
  - `effect: string`（DriverComboEffect）
- 日志格式：`DriverComboApplied <stage> <framesLeft>f`
- 相关机制：Driver Combo
- 测试覆盖：`tests/driver-combo.test.mjs`、`tests/driver-combo-scenario.test.mjs`
- 备注：`duration` 与 `framesLeft` 初始一致；duration 由 `DriverComboStageDurationFrames` 决定。

## DriverComboAdvanced

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/driver-combo.js`（`advance`）
  - 实际 emit：`src/core/combat-actor.js`（`onArtHit` 转发）
- 触发条件：在正确顺序下，Art 命中推进 stage（Break->Topple、Topple->Launch）。
- data 字段：
  - `fromStage: string`
  - `toStage: string`
  - `duration: number`
  - `framesLeft: number`
  - `effect: string`
- 日志格式：`DriverComboAdvanced <fromStage>-><toStage> <framesLeft>f`
- 相关机制：Driver Combo
- 测试覆盖：`tests/driver-combo.test.mjs`、`tests/driver-combo-scenario.test.mjs`
- 备注：推进会重置 framesLeft 为新阶段 duration。

## DriverComboRefreshed

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/driver-combo.js`（`refresh`）
  - 实际 emit：`src/core/combat-actor.js`（`onArtHit` 转发）
- 触发条件：在 `stage=Break` 再次命中 `effect=Break` 时刷新倒计时。
- data 字段：
  - `stage: string`
  - `duration: number`
  - `beforeFramesLeft: number`
  - `framesLeft: number`
  - `effect: string`
- 日志格式：`DriverComboRefreshed <stage> <beforeFramesLeft>f-><framesLeft>f`
- 相关机制：Driver Combo
- 测试覆盖：`tests/driver-combo.test.mjs`
- 备注：这是 V2 的容错验证点：重复 Break 刷新窗口。

## DriverComboFailed

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/driver-combo.js`（`apply` 的 wrong_order/invalid_* 分支）
  - 实际 emit：`src/core/combat-actor.js`（`onArtHit` 转发）
- 触发条件：Art 命中但 effect 与当前 stage 的期望不一致，或 effect/stage 无效。
- data 字段：
  - `stage: string`
  - `effect: string`
  - `requires: string`
  - `reason: 'wrong_order' | 'invalid_stage' | 'invalid_effect' | string`
- 日志格式：`DriverComboFailed stage=<stage> effect=<effect> requires=<requires>`
- 相关机制：Driver Combo
- 测试覆盖：`tests/driver-combo.test.mjs`、`tests/driver-combo-scenario.test.mjs`
- 备注：失败不推进 stage；用于“错序输入产出失败事件且不改变 stage”的可审计证据。

## DriverComboExpired

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/driver-combo.js`（`tick` 归零触发 `expire`）
  - 实际 emit：`src/core/combat-actor.js`（`tick` 每帧转发 `driverCombo.tick(1)` 的返回事件）
- 触发条件：Driver Combo 在某阶段倒计时归零。
- data 字段：
  - `stage: string`（过期前的 stage）
  - `reason: 'timeout' | 'zero' | string`
- 日志格式：`DriverComboExpired <stage>`
- 相关机制：Driver Combo
- 测试覆盖：`tests/driver-combo.test.mjs`（纯 state tick）、`tests/driver-combo-scenario.test.mjs`（expire-break/expire-topple）
- 备注：message 未展示 reason，但 reason 仍保留在 data 中（便于 future audit）。

## DriverComboFinished

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/driver-combo.js`（`finish`）
  - 实际 emit：`src/core/combat-actor.js`（`onArtHit` 转发）
- 触发条件：在 `stage=Launch` 时命中 `effect=Smash` 完成 Driver Combo。
- data 字段：
  - `stage: string`（完成前的 stage）
  - `effect: string`（默认 Smash）
- 日志格式：`DriverComboFinished <effect>`
- 相关机制：Driver Combo
- 测试覆盖：`tests/driver-combo.test.mjs`、`tests/driver-combo-scenario.test.mjs`
- 备注：完成后状态立即回到 `stage=None`；core 还会产生一个 VFX（SMASH!）但不额外发事件。

