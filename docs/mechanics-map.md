# V2.2 Mechanics Map

本文档列出 BattleSystem 当前机制地图（Mechanic Inventory），用于后续 V3 前的系统审计与接入点识别。机制本身以代码与测试为准；本文档提供“机制→文件→输入/输出/事件/不变量/测试”的可追溯索引。

## Input Intent

- 目的：把玩家输入表达为“意图”（移动向量/瞬时武技按键），而不是直接改变战斗状态。
- 所属层：`src/core`
- 主要文件：`src/core/combat-input.js`（`CombatInputFrame`）
- 输入：`moveX/moveY`（持续）、`artSlotsPressed[]`（瞬时 one-shot）
- 输出：`hasMoveIntent(deadZone)`、以及供输入缓冲写入的 `artSlotsPressed`
- 拥有状态：`CombatInputFrame { moveX, moveY, artSlotsPressed }`
- 发出事件：无（意图本身不发事件）
- 消费事件：无
- 关键不变量：
  - 输入只表达意图，不直接改战斗状态。
  - 移动是持续意图；武技是瞬时输入，交给输入缓冲处理。
- 测试覆盖：`tests/combat-core.test.mjs`（移动阻止普攻、startup 不软取消）、`tests/ui-module-load.test.mjs`（入口装配）
- 未来扩展点：V3 可在保持“意图层不变”的前提下新增 `specialPressed`、`bladeSwitchPressed` 等字段。
- 不应该做的事：在输入层实现“能否取消/能否命中/能否推进 combo”的规则判断。

## Input Buffer

- 目的：为瞬时武技输入提供短窗口缓冲，使“按键时机”与“可消费窗口”解耦。
- 所属层：`src/core`
- 主要文件：`src/core/combat-input.js`（`CombatCommandBuffer`）、`src/core/combat-actor.js`（写入与消费）
- 输入：每帧 `CombatInputFrame.artSlotsPressed`
- 输出：可被消费的 `slot`（`peekArtSlot()`）与 `hasArt()`；以及 buffer ratio（用于 UI）
- 拥有状态：`artSlot`, `framesLeft`, `maxFrames`
- 发出事件：`InputBuffered`、`InputConsumed`、`InputExpired`
- 消费事件：无（当前无事件驱动逻辑；消费由 core 直接调用 `consumeArt()`）
- 关键不变量：
  - 缓冲只存“最后一次 art slot + 剩余帧数”（不是队列）。
  - 过期必须产出 `InputExpired`，消费必须产出 `InputConsumed`。
- 测试覆盖：间接覆盖于 `tests/combat-core.test.mjs`（startup 输入不触发取消到 art）；`tests/driver-combo*.mjs`、scenarios（castArt 依赖缓冲）
- 未来扩展点：V3 可能需要“多键队列”或“多类指令缓冲”（special/blade），建议先在 dev scenario 覆盖确定性再升级结构。
- 不应该做的事：把“buffer 是否可消费”的规则写在 UI 里；UI 只负责产生输入帧。

## Action Timeline

- 目的：统一动作时序为 `Startup -> Active -> Recovery -> Finished`，并以帧为单位驱动。
- 所属层：`src/core`
- 主要文件：`src/core/action.js`（`CombatActionSpec/Instance`）
- 输入：动作配置（startup/active/recovery 帧数），以及 runtime `elapsedFrames`
- 输出：`phaseAt()`、`canCancelToMovement()`、`canCancelToArt()`、`shouldFireHit()`
- 拥有状态：`CombatActionInstance { elapsedFrames, hitFired, lastPhase }`
- 发出事件：由 `CombatActor` 发出 `ActionPhaseChanged`、`ActionFinished`
- 消费事件：无
- 关键不变量：
  - 相位边界与帧数一致（可通过 deterministic 测试验证）。
  - “命中触发点”只触发一次（`hitFired`），避免多次结算。
- 测试覆盖：`tests/combat-timing-smoke.test.mjs`（phaseAt 边界）、`tests/combat-core.test.mjs`（startup/active/recovery 行为）
- 未来扩展点：V3 需要更多动作类型（special）时，优先复用同一时间轴结构与事件模型。
- 不应该做的事：在 UI 中复制一份相位/取消判定逻辑。

## Auto Attack Chain

- 目的：实现 `AA1 -> AA2 -> AA3` 普攻链与“移动取消重置链”的规则。
- 所属层：`src/core`
- 主要文件：`src/core/action.js`（`AutoAttackChainSpec`）、`src/core/combat-actor.js`（runtime index 与状态机）
- 输入：`moveIntent`、`inAutoRange`、当前 `autoAttackIndex`
- 输出：启动普攻/推进下一段/重置链
- 拥有状态：`CombatActor.autoAttackIndex`、`CombatActor.action`
- 发出事件：`ActionStarted`、`ActionHit/ActionWhiffed`、`ActionFinished`、`AutoAttackChainAdvanced`、`AutoAttackChainReset`
- 消费事件：无
- 关键不变量：
  - 站定且在范围内才启动普攻；持续移动不启动普攻。
  - 普攻命中收益（充能、cancel window）发生后，移动取消不能回滚收益。
  - 移动取消后链重置到 AA1。
- 测试覆盖：`tests/combat-core.test.mjs`
- 未来扩展点：V3 可复用“普攻命中事件”作为 Special Gauge 充能入口候选点之一。
- 不应该做的事：在 UI 中实现“站定判断/范围判断/普攻链推进”。

## Art Charge / Ready / Consume

- 目的：为每个 Art 维护 charge、ready 与消耗，并由普攻命中驱动充能。
- 所属层：`src/core`
- 主要文件：`src/core/art.js`、`src/core/combat-actor.js`
- 输入：普攻命中后的 `artChargeGain`；以及“使用 art”时的消费动作
- 输出：`Art.ready`、charge 变化；以及“是否 becameReady”
- 拥有状态：`Art { charge, maxCharge }`
- 发出事件：`ArtChargeChanged`、`ArtBecameReady`、`ArtConsumed`
- 消费事件：`InputConsumed`（由 `tryUseBufferedReadyArt` 消费输入缓冲）
- 关键不变量：
  - 只有普攻命中才充能；whiff 不充能。
  - `ready => charge >= maxCharge`；消耗将 charge 归零（只能在 ready 时）。
- 测试覆盖：`tests/combat-core.test.mjs`（普攻命中充能、ready 事件、消费后释放）
- 未来扩展点：V3 的 Special Gauge 可复用“普攻命中充能逻辑”的结构（addCharge + becameReady + 事件）。
- 不应该做的事：把 charge/ready 判断写在 UI；UI 只显示 snapshot。

## Recovery Cancel

- 目的：把“动作是否允许在 Recovery 软取消到移动/Art”的权限作为数据驱动能力，而不是 UI 特判。
- 所属层：`src/core`
- 主要文件：`src/core/action.js`（`canCancelToMovement/Art`）、`src/core/combat-actor.js`（取消执行）
- 输入：当前 action 的 `elapsedFrames`（相位）、`moveIntent`、`inputBuffer`、Art ready
- 输出：从 AutoAttack Recovery 切到 Locomotion 或 Art
- 拥有状态：`CombatActor.state/action/currentArt/currentArtCanceled`
- 发出事件：`RecoveryCanceledToMovement`、`RecoveryCanceledToArt`
- 消费事件：`InputConsumed`（取消到 Art 时消耗缓冲）
- 关键不变量：
  - Startup 不能软取消（移动/武技都不行）。
  - Recovery Cancel 与 Cancel Bonus 是两个概念，禁止合并判断。
- 测试覆盖：`tests/combat-core.test.mjs`
- 未来扩展点：V3 如果引入 special cancel window，应复用“权限 + 相位 + 事件”模式，而不是在 UI 堆特判。
- 不应该做的事：把“是否在 Recovery”判断写在 UI 里做规则决策。

## Cancel Bonus

- 目的：在“普攻命中后短窗口内取消到 Art”时提供伤害奖励；与 Recovery Cancel 权限分离。
- 所属层：`src/core`
- 主要文件：`src/core/combat-actor.js`
- 输入：普攻命中、窗口帧数 `cancelBonusFrames`、取消到 Art 的时机
- 输出：`currentArtCanceled` 标记、Art 命中伤害倍率、窗口剩余帧数（用于 UI）
- 拥有状态：`CombatActor.cancelBonusLeft/cancelBonusFrames/cancelBonusDamageMultiplier`
- 发出事件：`CancelBonusWindowOpened`、`CancelBonusApplied`（以及 Art 的 `ActionHit` 会带 `canceled:true`）
- 消费事件：无
- 关键不变量：
  - 只有普攻命中才开启窗口；窗口按帧衰减。
  - Cancel Bonus 只在“从普攻 Recovery 取消到 Art”这一条路径上判定并生效。
- 测试覆盖：`tests/combat-core.test.mjs`（bonus 触发、伤害倍率、事件）
- 未来扩展点：V3 可把 Cancel Bonus 作为 Special Gauge 的“额外充能候选点”之一（设计上可选）。
- 不应该做的事：把 bonus 计算或窗口逻辑放到 UI 或 dev harness。

## Driver Combo

- 目的：验证一条控制链（Break/Topple/Launch/Smash）的状态推进、容错、失败与过期；仅由 Art 命中推进，whiff 不推进。
- 所属层：`src/core`
- 主要文件：`src/core/driver-combo.js`（`DriverComboState`）、`src/core/combat-actor.js`（Art 命中挂载与 emit）
- 输入：Art 命中时的 `art.effect`；以及每帧 tick 衰减
- 输出：`driverCombo.stage/framesLeft`、事件（Applied/Advanced/Refreshed/Failed/Expired/Finished）
- 拥有状态：`CombatActor.driverCombo`（`DriverComboState`）
- 发出事件：`DriverComboApplied`、`DriverComboAdvanced`、`DriverComboRefreshed`、`DriverComboFailed`、`DriverComboExpired`、`DriverComboFinished`
- 消费事件：无
- 关键不变量：
  - 仅在 Art 命中时 apply；whiff 不推进（必须可由事件日志观察）。
  - 顺序固定：Break -> Topple -> Launch -> Smash；错序只产出 Failed，不改变 stage。
  - Break 阶段再次 Break 会刷新倒计时；倒计时归零产出 Expired 并回 None；Smash 立即完成并回 None。
- 测试覆盖：`tests/driver-combo.test.mjs`、`tests/driver-combo-scenario.test.mjs`
- 未来扩展点：V3 Blade Combo 应与 Driver Combo 并行存在（类似一个独立状态机 + 事件 + snapshot 字段）。
- 不应该做的事：把路线规则写进 UI；或让 Blade Combo 覆盖/替代 Driver Combo。

## Event Log

- 目的：把关键行为写成可观察事件（frame/type/message/data），供 UI、trace、tests 与 future tooling 审计。
- 所属层：`src/core`
- 主要文件：`src/core/combat-event-log.js`、`src/core/combat-events.js`
- 输入：`actor.emit(type, data)` 或 `emitCombatEvent(eventLog, frame, type, data)`
- 输出：`eventLog.events`（最新在前）、`eventLog.unread`、`eventLog.toText()`（供 UI 展示）
- 拥有状态：`CombatEventLog { events[], unread[] }`
- 发出事件：N/A（事件日志本身不再产生事件）
- 消费事件：`src/dev/trace-recorder.js` 与 scenarios/tests 会读取 `eventLog.events`
- 关键不变量：
  - `events` 头部是最新事件（`unshift`），保证 trace 的“增量抓取 head 指针”成立。
  - 重要行为必须能从 event log 追溯。
- 测试覆盖：`tests/driver-combo.test.mjs`（formatCombatEvent 文本）、`tests/combat-core.test.mjs`（findEvent）
- 未来扩展点：V3 新机制必须补齐事件（用于 scenario proof 与 audit）。
- 不应该做的事：把事件当作唯一状态来源（状态仍在 core 的 runtime 字段中，事件是可观察副产物）。

## Snapshot API

- 目的：提供 UI/trace/tests 读取战斗状态的稳定入口，避免 UI 直接读内部字段导致耦合。
- 所属层：`src/core`
- 主要文件：`src/core/combat-actor.js`（`getSnapshot()`）
- 输入：actor runtime 状态
- 输出：包含 frame/state/position/ranges/action/arts/cancelBonus/inputBuffer/driverCombo/eventLogText/config/vfx/paused 的快照对象
- 拥有状态：无（快照是派生数据）
- 发出事件：无
- 消费事件：无
- 关键不变量：
  - UI 只读 snapshot；不应读取 actor 内部字段实现规则。
  - 快照字段应足以支撑验证（trace/proof/UI）与后续机制可视化。
- 测试覆盖：`tests/scenario-runner.test.mjs`（assertSnapshot 使用）、`tests/driver-combo-scenario.test.mjs`（finalSnapshot）
- 未来扩展点：V3 新机制优先把可视化/断言所需数据加入 snapshot，而不是让 UI 走“内部字段”。
- 不应该做的事：让 snapshot 变成“可写接口”或从 UI 回写影响规则。

## Scenario Runner

- 目的：用纯逻辑 steps（wait/cast/assert）驱动 actor.tick，输出 PASS/FAIL、proof 与 trace，作为确定性验收工具。
- 所属层：`src/dev`
- 主要文件：`src/dev/scenario-runner.js`、`src/dev/scenarios.js`
- 输入：`actor`、`steps[]`、`prepare(actor)`、`maxFrames`
- 输出：`{ passed, failedStep, proof[], trace[], finalSnapshot }`
- 拥有状态：runner runtime（`framesElapsed/stepIndex/recorder/proof`）
- 发出事件：无（但会驱动 core 产生事件，并在 proof 中引用）
- 消费事件：读取 `actor.eventLog.events` 用于 `assertEvent/waitUntil` 断言
- 关键不变量：
  - runner 不修改 core 规则；只通过输入帧驱动 tick。
  - 失败必须给出失败步骤与 trace tail，便于审计。
- 测试覆盖：`tests/scenario-runner.test.mjs`、`tests/driver-combo-scenario.test.mjs`
- 未来扩展点：V3 所有新机制应新增 scenarios（happy path / wrong order / expire 等），并纳入 `npm test`。
- 不应该做的事：在 scenario runner 中写规则分支去“修正”战斗行为。

## Trace Recorder

- 目的：按帧采样 `actor.getSnapshot()` + “本帧新增事件摘要”，生成可压缩的 trace，用于 debug 面板与测试证据。
- 所属层：`src/dev`
- 主要文件：`src/dev/trace-recorder.js`
- 输入：`record(actor, {note})`
- 输出：`records[]`、`formatTail(count)`
- 拥有状态：`records[]`、`lastHeadEvent`（用于增量抓取）
- 发出事件：无
- 消费事件：读取 `actor.eventLog.events` 并按 head 指针计算新事件
- 关键不变量：
  - 依赖 `eventLog.events[0]` 为 head（最新事件），否则增量抓取会失真。
  - trace 只记录摘要，不复制完整 snapshot（避免体积过大）。
- 测试覆盖：间接覆盖于 `tests/scenario-runner.test.mjs`（trace 为数组）、driver combo scenarios（FAIL 时输出 tail）
- 未来扩展点：V3 可在 trace record 中增加 special/blade 状态摘要字段（来自 snapshot）。
- 不应该做的事：让 trace recorder 直接访问 DOM 或把它变成“回放引擎”。

## Browser Debug UI

- 目的：浏览器可视化验证壳：输入、画布渲染、事件日志面板、调参、Scenario 一键 Run、Debug 输入（Grant Ready/StepToRecovery/Cast）。
- 所属层：`src/ui`
- 主要文件：`src/ui/sandbox-app.js`、`src/ui/debug-panel.js`、`src/ui/browser-input.js`、`src/ui/canvas-renderer.js`
- 输入：浏览器键盘事件、按钮点击、slider 调参、scenario 名称
- 输出：`actor.tick()` 调用、Debug 事件 `DebugGrantArtsReady`、UI 渲染与 PASS/FAIL proof 输出
- 拥有状态：UI 组件状态（keys/oneShot、DOM refs）
- 发出事件：`DebugGrantArtsReady`（由 debug panel / dev scenarios 直接发出，用于验证准备）
- 消费事件：读取 `actor.getSnapshot()` 与 `actor.eventLog`（渲染）
- 关键不变量：
  - UI 不决定战斗规则，只驱动 tick 并展示可观察结果。
  - Scenario 结果必须可解释（proof + trace tail）。
- 测试覆盖：`tests/ui-module-load.test.mjs`
- 未来扩展点：V3 新机制 UI 展示应基于 snapshot 字段与事件，而不是直接访问 core 内部实现。
- 不应该做的事：把 Special/Blade Combo 写死到 UI；或让 UI 特判推进/失败条件。

