# V4.2 Event Catalog

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
- 测试覆盖：间接（scenarios 的 prepare 会调用）、`tests/player-defeat-polish.test.mjs`
- 备注：`resetRuntime({ keepLog:false })` 默认会清空 eventLog 后再 emit Reset。

## BattleStarted

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`resetRuntime`）
- 触发条件：actor 重置后开始一场新的 battle（初始化 target hp/dead/battle 状态）。
- data 字段：
  - `targetId: string`
  - `targetHp: number`
  - `targetMaxHp: number`
- 日志格式：`BattleStarted target=<targetId> hp=<targetHp>/<targetMaxHp>`
- 相关机制：Battle / HP / Result、Scenario Runner（prepare 会 reset）
- 测试覆盖：`tests/single-driver-mvp.test.mjs`、`tests/routine-orb-scenario.test.mjs`（proof 断言存在）

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

## EnemyTargetSelected

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：enemy 首次确认/修正目标（当前版本固定为 Player）时发出一次。
- data 字段：
  - `enemyId: string`
  - `targetId: string`
- 日志格式：`EnemyTargetSelected enemy=<enemyId> target=<targetId>`
- 相关机制：Enemy Attack（最小 AI：锁定目标并驱动攻击）
- 测试覆盖：间接（enemy attack tests/scenarios 会触发，但未做显式断言）

## EnemyAttackStarted

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：敌方满足攻击条件（在 EnemyStrike 范围内、冷却为 0、且未处于 Driver Combo 控制）时启动一次 EnemyStrike action。
- data 字段：
  - `attackId: string`（当前默认 `EnemyStrike`）
  - `enemyId: string`
  - `targetId: string`
- 日志格式：`EnemyAttackStarted <attackId>`
- 相关机制：EnemyStrike、DriverCombo control、Battle / HP / Result
- 测试覆盖：`tests/enemy-attack.test.mjs`、`tests/enemy-attack-scenario.test.mjs`（显式断言/场景 proof）

## EnemyAttackPhaseChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：EnemyStrike 的 action 相位发生变化（Startup/Active/Recovery/Finished）。
- data 字段：
  - `attackId: string`
  - `before: string`（ActionPhase）
  - `after: string`（ActionPhase）
  - `enemyId: string`
- 日志格式：`EnemyAttackPhaseChanged <attackId> <before>-><after>`
- 相关机制：Enemy Action Timeline
- 测试覆盖：`tests/enemy-attack.test.mjs`（断言相位顺序）

## EnemyAttackHit

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：EnemyStrike 命中触发点到达，且玩家仍在 EnemyStrike 范围内。
- data 字段：
  - `attackId: string`
  - `damage: number`
  - `enemyId: string`
  - `targetId: string`
- 日志格式：`EnemyAttackHit <attackId> damage=<damage>`
- 相关机制：Player Damage / Defeat
- 测试覆盖：`tests/enemy-attack.test.mjs`、`tests/enemy-attack-scenario.test.mjs`（显式断言/场景 proof）

## EnemyAttackWhiffed

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：EnemyStrike 命中触发点到达，但玩家不在 EnemyStrike 范围内。
- data 字段：
  - `attackId: string`
  - `reason: 'out_of_range' | string`
  - `enemyId: string`
- 日志格式：`EnemyAttackWhiffed <attackId> reason=<reason>`
- 相关机制：EnemyStrike Hit/Whiff
- 测试覆盖：`tests/enemy-attack.test.mjs`、`tests/enemy-attack-scenario.test.mjs`（out_of_range 分支）

## EnemyAttackFinished

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：EnemyStrike action 进入 Finished 相位并在本帧完成收尾后发出。
- data 字段：
  - `attackId: string`
  - `enemyId: string`
- 日志格式：`EnemyAttackFinished <attackId>`
- 相关机制：EnemyStrike Timeline
- 测试覆盖：`tests/enemy-attack.test.mjs`（显式断言存在）

## EnemyAttackCooldownStarted

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：一次 EnemyStrike action 结束后进入冷却，且 `cooldownLeft>0` 时发出。
- data 字段：
  - `attackId: string`
  - `enemyId: string`
  - `frames: number`
- 日志格式：`EnemyAttackCooldownStarted <attackId> <frames>f`
- 相关机制：EnemyStrike Cooldown
- 测试覆盖：`tests/enemy-attack.test.mjs`、`tests/enemy-attack-scenario.test.mjs`

## EnemyAttackCooldownFinished

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：`cooldownLeft` 从 >0 递减到 0 的那一帧发出。
- data 字段：
  - `attackId: string`
  - `enemyId: string`
- 日志格式：`EnemyAttackCooldownFinished <attackId>`
- 相关机制：EnemyStrike Cooldown
- 测试覆盖：`tests/enemy-attack.test.mjs`、`tests/enemy-attack-scenario.test.mjs`

## EnemyControlled

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：Driver Combo stage 为 `Topple/Launch` 时，enemy 从非 Controlled 进入 Controlled 的那一帧发出。
- data 字段：
  - `enemyId: string`
  - `stage: string`（DriverComboStage）
  - `framesLeft: number`
- 日志格式：`EnemyControlled stage=<stage> <framesLeft>f`
- 相关机制：DriverCombo control gate（enemy）
- 测试覆盖：`tests/enemy-attack.test.mjs`、`tests/enemy-attack-scenario.test.mjs`

## EnemyStrikeStarted

- 定义位置：`src/core/enums.js`
- 发出位置：无（当前实现未使用；已由 `EnemyAttackStarted` 覆盖）
- 触发条件：N/A
- data 字段：
  - `strikeId: string`
  - `enemyId: string`
- 日志格式：`EnemyStrikeStarted <strikeId>`
- 相关机制：Legacy/兼容事件名（保留枚举值以避免破坏外部引用）
- 测试覆盖：无

## EnemyStrikePhaseChanged

- 定义位置：`src/core/enums.js`
- 发出位置：无（当前实现未使用；已由 `EnemyAttackPhaseChanged` 覆盖）
- 触发条件：N/A
- data 字段：
  - `strikeId: string`
  - `before: string`（ActionPhase）
  - `after: string`（ActionPhase）
- 日志格式：`EnemyStrikePhaseChanged <strikeId> <before>-><after>`
- 相关机制：Legacy/兼容事件名
- 测试覆盖：无

## EnemyStrikeHit

- 定义位置：`src/core/enums.js`
- 发出位置：无（当前实现未使用；已由 `EnemyAttackHit` 覆盖）
- 触发条件：N/A
- data 字段：
  - `strikeId: string`
  - `damage: number`
  - `enemyId: string`
- 日志格式：`EnemyStrikeHit <strikeId> damage=<damage>`
- 相关机制：Legacy/兼容事件名
- 测试覆盖：无

## EnemyStrikeWhiffed

- 定义位置：`src/core/enums.js`
- 发出位置：无（当前实现未使用；已由 `EnemyAttackWhiffed` 覆盖）
- 触发条件：N/A
- data 字段：
  - `strikeId: string`
  - `reason: 'out_of_range' | string`
- 日志格式：`EnemyStrikeWhiffed <strikeId> reason=<reason>`
- 相关机制：Legacy/兼容事件名
- 测试覆盖：无

## EnemyStrikeInterrupted (deprecated) — 已由 EnemyAttackInterrupted 取代

- 定义位置：`src/core/enums.js`
- 发出位置：无（当前实现未使用；已由 `EnemyAttackInterrupted` 覆盖）
- 触发条件：N/A（deprecated，保留以兼容外部引用）
- data 字段：
  - `strikeId: string`
  - `reason: 'driver_combo' | string`
  - `stage: string`（DriverComboStage）
  - `enemyId: string`
- 日志格式：`EnemyStrikeInterrupted <strikeId> reason=<reason>`
- 相关机制：Legacy/兼容事件名
- 测试覆盖：无（deprecated）
- 备注：deprecated — 后续代码请使用 `EnemyAttackInterrupted`（`attackId=EnemyStrike`）。

## EnemyAttackInterrupted

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`tickEnemy`）
- 触发条件：敌方处于 Driver Combo 控制（Topple/Launch）时，若正在执行 EnemyStrike 且处于 Startup/Active 阶段，则被中断并进入冷却。
- data 字段：
  - `attackId: string`（当前默认 `EnemyStrike`）
  - `reason: 'driver_combo' | string`
  - `stage: string`（DriverComboStage）
  - `enemyId: string`
- 日志格式：`EnemyAttackInterrupted <attackId> reason=<reason>`
- 相关机制：DriverCombo control gate（enemy）
- 测试覆盖：`tests/enemy-attack.test.mjs`（显式断言存在）

## EnemyStrikeFinished

- 定义位置：`src/core/enums.js`
- 发出位置：无（当前实现未使用；已由 `EnemyAttackFinished` 覆盖）
- 触发条件：N/A
- data 字段：
  - `strikeId: string`
  - `enemyId: string`
- 日志格式：`EnemyStrikeFinished <strikeId>`
- 相关机制：Legacy/兼容事件名
- 测试覆盖：无

## DamageApplied

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`applyDamageToTarget`、`applyDamageToPlayer`）
- 触发条件：任何来源尝试对 target 或 player 扣血（普攻/Art/Special/元素伤害/DoT tick/EnemyStrike）。
- data 字段：
  - `targetId: string`
  - `amount: number`（本次实际扣血；可能为 0）
  - `source: 'AutoAttack' | 'Art' | 'Special' | 'Element' | 'Debuff' | string`
  - `sourceId: string|null`
  - `enemyId: string|null`（可选：EnemyStrike 相关）
  - `beforeHp: number`
  - `afterHp: number`
- 日志格式：`DamageApplied target=<targetId> amount=<amount> src=<source>`
- 相关机制：Battle / HP / Result
- 测试覆盖：`tests/single-driver-mvp.test.mjs`、`tests/routine-orb-scenario.test.mjs`（proof 断言存在）
- 备注：当 battle 已结束/target 已 dead/amount<=0 时，仍会记录一条 amount=0 的 DamageApplied（用于审计“尝试发生过”）。

## TargetHpChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`applyDamageToTarget`）
- 触发条件：target hp 确实发生变化时（before != after）。
- data 字段：
  - `targetId: string`
  - `before: number`
  - `after: number`
  - `maxHp: number`
- 日志格式：`TargetHpChanged <before>-><after>/<maxHp>`
- 相关机制：Battle / HP / Result
- 测试覆盖：`tests/single-driver-mvp.test.mjs`、`tests/routine-orb-scenario.test.mjs`（proof 断言存在）

## TargetDefeated

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`applyDamageToTarget`）
- 触发条件：hp 归零且此前未 dead。
- data 字段：
  - `targetId: string`
- 日志格式：`TargetDefeated target=<targetId>`
- 相关机制：Battle / HP / Result、Debuff kill
- 测试覆盖：`tests/routine-orb.test.mjs`、`tests/routine-orb-scenario.test.mjs`、`tests/single-driver-mvp.test.mjs`
- 备注：该事件之后 battle 会结束，tick 仍允许处理 vfx，但不再推进战斗规则。

## PlayerHpChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`applyDamageToPlayer`）
- 触发条件：player hp 确实发生变化时（before != after）。
- data 字段：
  - `before: number`
  - `after: number`
  - `maxHp: number`
- 日志格式：`PlayerHpChanged <before>-><after>/<maxHp>`
- 相关机制：Battle / HP / Result、EnemyStrike
- 测试覆盖：`tests/enemy-strike-scenario.test.mjs`（Defeat scenario 间接覆盖）

## PlayerDefeated

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`applyDamageToPlayer`）
- 触发条件：player hp 归零且此前未 dead。
- data 字段：无（`{}`）
- 日志格式：`PlayerDefeated`
- 相关机制：Battle / HP / Result、EnemyStrike
- 测试覆盖：`tests/enemy-strike-scenario.test.mjs`

## BattleEnded

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`applyDamageToTarget`、`applyDamageToPlayer`）
- 触发条件：battle 结束时（当前实现 Victory / Defeat）。
- data 字段：
  - `result: 'Victory' | 'Defeat' | string`
- 日志格式：`BattleEnded result=<result>`
- 相关机制：Battle / HP / Result
- 测试覆盖：`tests/routine-orb.test.mjs`、`tests/routine-orb-scenario.test.mjs`、`tests/single-driver-mvp.test.mjs`

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

## DebugGrantSpecialReady

- 定义位置：`src/core/enums.js`
- 发出位置：
  - `src/core/combat-actor.js`（`debugGrantSpecialReady`）
  - `src/ui/debug-panel.js`（Grant Special 按钮）
  - `src/dev/scenario-runner.js`（Grant Special step）
- 触发条件：调试/场景准备阶段强制设置 special gauge charge（通常按等级阈值设置），并记录一次事件。
- data 字段：
  - `charge: number`（0..300）
  - `level: number|null`（若通过等级注入则为 1..3；否则可为 null）
- 日志格式：`DebugGrantSpecialReady charge=<charge> L<level>`
- 相关机制：Special Gauge、Scenario Runner、Browser Debug UI
- 测试覆盖：间接（blade combo scenarios 使用 Grant Special 来稳定准备）
- 备注：这是“调试注入”事件，不属于正常玩法。

## SpecialChargeChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onArtHit`）
- 触发条件：Art 命中后 `art.specialChargeGain > 0` 且 charge 发生变化时。
- data 字段：
  - `beforeCharge: number`
  - `afterCharge: number`
  - `beforeReadyLevel: number`（0..3）
  - `afterReadyLevel: number`（0..3）
  - `artId?: string`（充能来源 Art）
- 日志格式：`SpecialChargeChanged <beforeCharge>-><afterCharge> L<beforeReadyLevel>->L<afterReadyLevel> from=<artId>`
- 相关机制：Special Gauge
- 测试覆盖：`tests/special-actor.test.mjs`（断言 afterCharge 变化）
- 备注：当前实现只由 Art 命中充能；whiff 不会产生该事件。

## SpecialBecameReady

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onArtHit`）
- 触发条件：`SpecialGaugeState.addCharge()` 返回 `becameReady:true`（跨过阈值进入更高 readyLevel）。
- data 字段：
  - `readyLevel: number`（1..3）
  - `charge: number`
  - `artId?: string`（充能来源 Art）
- 日志格式：`SpecialBecameReady L<readyLevel> charge=<charge>`
- 相关机制：Special Gauge
- 测试覆盖：`tests/special-actor.test.mjs`（断言 readyLevel=1/2/3）
- 备注：只在 readyLevel 上升时触发；同一等级内追加 charge 不触发。

## SpecialConsumed

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`castSpecial`）
- 触发条件：释放 Special 成功，且 gauge 消耗成功后。
- data 字段：
  - `specialId: string`
  - `level: number`（1..3）
  - `cost: number`（level * 100）
  - `beforeCharge: number`
  - `afterCharge: number`
- 日志格式：`SpecialConsumed <specialId> L<level> cost=<cost> <beforeCharge>-><afterCharge>`
- 相关机制：Special Gauge、Special Cast
- 测试覆盖：`tests/special-actor.test.mjs`（断言存在该事件）
- 备注：消费成功后会启动对应 action（随后产生 `ActionStarted/ActionPhaseChanged/...`）。

## SpecialCastFailed

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`castSpecial`）
- 触发条件：尝试释放 Special，但因为条件不满足而失败。
- data 字段：
  - `specialId: string`
  - `reason: 'unknown_special' | 'busy' | 'out_of_range' | 'insufficient_level' | string`
- 日志格式：`SpecialCastFailed <specialId> reason=<reason>`
- 相关机制：Special Cast
- 测试覆盖：`tests/special-actor.test.mjs`（insufficient_level）
- 备注：失败不会启动动作。

## SpecialHit

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onSpecialHit`）
- 触发条件：Special 命中结算（目标在 artRange 内）。
- data 字段：
  - `specialId: string`
  - `element: string|null`（当前默认元素：Fire/Water）
  - `level: number`
  - `damage: number`
- 日志格式：`SpecialHit <specialId> element=<element> L<level> damage=<damage>`
- 相关机制：Special Cast、Blade Combo（以 element+level 作为推进输入）
- 测试覆盖：`tests/special-actor.test.mjs`（断言 SpecialHit 字段）
- 备注：同一帧还会产生一条 `ActionHit <actionId>`（actionId 为 `FireLv1_Action` 等）。

## BladeComboStarted

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/blade-combo.js`（`BladeComboState.apply`）
  - 实际 emit：`src/core/combat-actor.js`（`onSpecialHit` 转发）
- 触发条件：在 `stage=None` 时，Special 命中且匹配某条路线的第一步。
- data 字段（核心字段）：
  - `routeId: string`
  - `stage: string`（Stage1）
  - `element: string`
  - `level: number`
  - `framesLeft: number`
  - `expectedNextElement: string|null`
  - `expectedNextMinLevel: number`
- 日志格式：`BladeComboStarted route=<routeId> <stage> element=<element> next=<expectedNextElement> minL=<expectedNextMinLevel> <framesLeft>f`
- 相关机制：Blade Combo
- 测试覆盖：`tests/blade-combo-scenario.test.mjs`

## BladeComboAdvanced

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/blade-combo.js`（`BladeComboState.apply`）
  - 实际 emit：`src/core/combat-actor.js`（`onSpecialHit` 转发）
- 触发条件：在正确顺序下，Special 命中推进 stage（Stage1->Stage2）。
- data 字段（核心字段）：
  - `routeId: string`
  - `fromStage: string`
  - `toStage: string`
  - `element: string`
  - `level: number`
  - `framesLeft: number`
  - `expectedNextElement: string|null`
  - `expectedNextMinLevel: number`
- 日志格式：`BladeComboAdvanced route=<routeId> <fromStage>-><toStage> element=<element> next=<expectedNextElement> minL=<expectedNextMinLevel> <framesLeft>f`
- 相关机制：Blade Combo
- 测试覆盖：`tests/blade-combo-scenario.test.mjs`

## BladeComboFailed

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/blade-combo.js`（`BladeComboState.apply`）
  - 实际 emit：`src/core/combat-actor.js`（`onSpecialHit` 转发）
- 触发条件：Special 命中但无法开始/推进路线（无路线、错元素、等级不足、内部 route 缺失等）。
- data 字段（常见字段）：
  - `stage: string`
  - `routeId?: string`
  - `element: string`
  - `level: number`
  - `requiresElement?: string`
  - `requiresMinLevel?: number`
  - `reason: 'invalid_element' | 'no_route' | 'missing_route' | 'no_expected_next' | 'wrong_element' | 'insufficient_level' | string`
- 日志格式：`BladeComboFailed stage=<stage> element=<element> requires=<requiresElement> minL=<requiresMinLevel> reason=<reason>`
- 相关机制：Blade Combo
- 测试覆盖：`tests/blade-combo-scenario.test.mjs`（wrong_element / insufficient_level / no_route）
- 备注：失败不推进 stage；用于“错序/不满足条件不推进”的可审计证据。

## BladeComboExpired

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/blade-combo.js`（`BladeComboState.tick/expire`）
  - 实际 emit：`src/core/combat-actor.js`（`tick` 每帧转发 `bladeCombo.tick(1)` 的返回事件）
- 触发条件：Blade Combo 倒计时归零。
- data 字段：
  - `stage: string`（过期前阶段）
  - `routeId: string|null`
  - `stepIndex: number`
  - `reason: 'timeout' | 'zero' | string`
- 日志格式：`BladeComboExpired <stage> reason=<reason>`
- 相关机制：Blade Combo
- 测试覆盖：`tests/blade-combo-scenario.test.mjs`（expire-blade-combo）

## BladeComboFinished

- 定义位置：`src/core/enums.js`
- 发出位置：
  - 事件对象产出：`src/core/blade-combo.js`（`BladeComboState.apply`）
  - 实际 emit：`src/core/combat-actor.js`（`onSpecialHit` 转发）
- 触发条件：命中最后一步，完成路线。
- data 字段：
  - `routeId: string`
  - `fromStage: string`
  - `fromStepIndex: number`
  - `element: string`
  - `level: number`
- 日志格式：`BladeComboFinished route=<routeId> element=<element>`
- 相关机制：Blade Combo、Tokens
- 测试覆盖：`tests/blade-combo-scenario.test.mjs`
- 备注：完成后 core 会创建 token，并紧接着产生 `TokenCreated`。

## TokenCreated

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onSpecialHit` 的 token 处理分支）
- 触发条件：Blade Combo 完成后创建 token。
- data 字段：
  - `id: string`
  - `element: string|null`
  - `sourceRouteId: string|null`
  - `createdFrame: number`
- 日志格式：`TokenCreated <id> element=<element> route=<sourceRouteId>`
- 相关机制：Tokens
- 测试覆盖：`tests/blade-combo-scenario.test.mjs`（断言 TokenCreated 与 snapshot tokens）
- 备注：本仓库只验证 token 的产出与可观察性；明确不实现 token 的消费/兑现（例如 Chain Attack 或其它 cash-out 机制）。

## RoutineTileAdded

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onArtHit` 的 Routine Skill 分支）
- 触发条件：Art 命中且能映射到 Routine Skill 时，添加一张 tile（添加后 tiles 上限仍为 3）。
- data 字段：
  - `routineId: string`
  - `skillId: string`
  - `layer: number`
  - `tilesCount: number`（添加后数量）
  - `beforeTilesCount: number`
- 日志格式：`RoutineTileAdded routine=<routineId> layer=<layer> tiles=<tilesCount>`
- 相关机制：Routine Tiles、Routine Orb
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`、`tests/single-driver-mvp.test.mjs`（proof 断言存在）

## RoutineTileRemoved

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onArtHit` 添加 tile 超出上限后的移除分支）
- 触发条件：添加 tile 后超过上限（3 张）时移除最旧 tile。
- data 字段：
  - `routineId: string`
  - `skillId: string`
  - `layer: number`
  - `tilesCount: number`（移除后数量）
- 日志格式：`RoutineTileRemoved routine=<routineId> layer=<layer> tiles=<tilesCount>`
- 相关机制：Routine Tiles
- 测试覆盖：间接（当前内置场景主要使用 3 张组合；该事件在超出上限的场景中可被验证）

## RoutineOrbCreated

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onArtHit` tile 更新后）
- 触发条件：最近 3 张 tile 同一 routineId 且此前无 active orb 时创建 orb。
- data 字段：
  - `routineId: string`
  - `totalLayer: number`
- 日志格式：`RoutineOrbCreated routine=<routineId> totalLayer=<totalLayer>`
- 相关机制：Routine Orb
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`、`tests/single-driver-mvp.test.mjs`（proof 断言存在）

## RoutineOrbReplaced

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`onArtHit` tile 更新后）
- 触发条件：满足创建条件且此前已有 active orb 时，以新 orb 替换旧 orb。
- data 字段：
  - `routineId: string`
  - `totalLayer: number`
  - `beforeRoutineId: string`
  - `beforeTotalLayer: number`
- 日志格式：`RoutineOrbReplaced routine=<routineId> totalLayer=<totalLayer>`
- 相关机制：Routine Orb
- 测试覆盖：间接（当前 MVP 场景主要验证 Created；Replaced 作为可扩展分支保留）

## RoutineOrbBreakFailed

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`breakRoutineOrb`）
- 触发条件：调用 `actor.breakRoutineOrb()` 但当前没有 active orb。
- data 字段：
  - `reason: 'no_orb' | string`
- 日志格式：`RoutineOrbBreakFailed reason=<reason>`
- 相关机制：Orb Break
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`（without-orb proof）

## RoutineOrbBreakStarted

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`breakRoutineOrb`）
- 触发条件：开始一次破球结算。
- data 字段：
  - `routineId: string`
  - `totalLayer: number`
- 日志格式：`RoutineOrbBreakStarted routine=<routineId> totalLayer=<totalLayer>`
- 相关机制：Orb Break
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`

## ElementDamageApplied

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`breakRoutineOrb`）
- 触发条件：破球造成一次元素伤害（随后必须通过 `DamageApplied` 扣血通路结算）。
- data 字段：
  - `element: string`
  - `amount: number`
  - `totalLayer?: number`
- 日志格式：`ElementDamageApplied element=<element> amount=<amount>`
- 相关机制：Orb Break、Battle / HP / Result
- 测试覆盖：`tests/single-driver-mvp.test.mjs`（proof 断言存在）

## DebuffApplied

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（当前由 `breakRoutineOrb` 施加 Burn）
- 触发条件：某个 debuff 被施加到 target（当前只实现 Burn）。
- data 字段：
  - `type: string`（例如 Burn）
  - `durationFrames: number`
- 日志格式：`DebuffApplied <type> <durationFrames>f`
- 相关机制：Debuffs（Burn）
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`、`tests/single-driver-mvp.test.mjs`

## RoutineOrbBroken

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`breakRoutineOrb`）
- 触发条件：破球主要结算完成并确认本次 orb 已被破坏。
- data 字段：
  - `routineId: string`
  - `totalLayer: number`
- 日志格式：`RoutineOrbBroken routine=<routineId> totalLayer=<totalLayer>`
- 相关机制：Orb Break
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`、`tests/single-driver-mvp.test.mjs`

## RoutineOrbBreakFinished

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`breakRoutineOrb`）
- 触发条件：破球结算收尾（已清空 routineOrb/routineTiles）。
- data 字段：无（`{}`）
- 日志格式：`RoutineOrbBreakFinished`
- 相关机制：Orb Break
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`（break 场景 proof）

## DebuffTickDamage

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（每帧 `tickDebuffs` 结算时）
- 触发条件：debuff 达到 tick 时机并产生一次伤害。
- data 字段：
  - `type: string`
  - `amount: number`
- 日志格式：`DebuffTickDamage <type> amount=<amount>`
- 相关机制：Debuffs（Burn）、Battle / HP / Result
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`（burn-kill proof）

## DebuffExpired

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（每帧 `tickDebuffs` 结算时）
- 触发条件：debuff 计时归零并从列表移除。
- data 字段：
  - `type: string`
- 日志格式：`DebuffExpired <type>`
- 相关机制：Debuffs（Burn）
- 测试覆盖：间接（当前 MVP 场景主要验证击杀闭环；到期事件保留用于 future 验证）

## V5.1 Backpack / Blade Events

### BackpackResolved

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/loadout-resolver.js`（`resolveLoadout`）
- 触发条件：背包布局合法，解析成功时。
- data 字段：
  - `activeBladeCount: number`
- 日志格式：`BackpackResolved activeBlades=N`
- 相关机制：Backpack / Loadout Resolver
- 测试覆盖：`tests/loadout-resolver.test.mjs`、`tests/backpack-blade-scenario.test.mjs`

### BackpackInvalid

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/loadout-resolver.js`（`resolveLoadout`）
- 触发条件：背包存在越界/重叠错误时。
- data 字段：
  - `errorCount: number`
- 日志格式：`BackpackInvalid errors=N`
- 相关机制：Backpack / Loadout Resolver
- 测试覆盖：`tests/loadout-resolver.test.mjs`、`tests/backpack-blade-scenario.test.mjs`

### BladeLinked

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`linkBlade`）
- 触发条件：从 resolvedBlade 创建 BladeRuntime 并加入战斗时。
- data 字段：
  - `bladeId: string`
  - `role: string`
- 日志格式：`BladeLinked blade=X role=Y`
- 相关机制：Backpack / Blade Runtime
- 测试覆盖：`tests/backpack-blade-scenario.test.mjs`

### BladeSocketResolved

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/combat-actor.js`（`linkBlade`）
- 触发条件：Blade 内部 socket 插入了 ElementCore 时。
- data 字段：
  - `bladeId: string`
  - `element: string`
- 日志格式：`BladeSocketResolved blade=X element=Y`
- 相关机制：Nested Socket / Element Core
- 测试覆盖：`tests/backpack-blade-scenario.test.mjs`

### BladeAttackStarted

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/blade-runtime.js`（`tick`）
- 触发条件：BladeRuntime 状态从 Idle 进入 Attacking 时。
- data 字段：
  - `bladeId: string`
- 日志格式：`BladeAttackStarted blade=X`
- 相关机制：Blade Runtime / Auto Attack
- 测试覆盖：`tests/blade-runtime.test.mjs`、`tests/backpack-blade-scenario.test.mjs`

### BladeAttackPhaseChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/blade-runtime.js`（`tick`）
- 触发条件：BladeRuntime 动作阶段发生变化（None→Startup→Active→Recovery→Finished）。
- data 字段：
  - `bladeId: string`
  - `before: string`
  - `after: string`
- 日志格式：`BladeAttackPhaseChanged blade=X A->B`
- 相关机制：Blade Runtime / Action Timeline
- 测试覆盖：间接（blade-runtime.test 通过 tick 验证）

### BladeAttackHit

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/blade-runtime.js`（`tick`）
- 触发条件：BladeRuntime 在 Active 帧且 target 在 range 内。
- data 字段：
  - `bladeId: string`
  - `element: string`
  - `damage: number`
- 日志格式：`BladeAttackHit blade=X element=Y damage=Z`
- 相关机制：Blade Runtime / Damage
- 测试覆盖：`tests/blade-runtime.test.mjs`、`tests/backpack-blade-scenario.test.mjs`

### BladeAttackWhiffed

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/blade-runtime.js`（`tick`）
- 触发条件：BladeRuntime 在 Active 帧但 target 不在 range 内。
- data 字段：
  - `bladeId: string`
  - `reason: 'out_of_range'`
- 日志格式：`BladeAttackWhiffed blade=X reason=Y`
- 相关机制：Blade Runtime / Range Check
- 测试覆盖：`tests/blade-runtime.test.mjs`、`tests/backpack-blade-scenario.test.mjs`

### BladeAttackFinished

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/blade-runtime.js`（`tick`）
- 触发条件：BladeRuntime 动作进入 Finished 阶段。
- data 字段：
  - `bladeId: string`
- 日志格式：`BladeAttackFinished blade=X`
- 相关机制：Blade Runtime / Action Timeline
- 测试覆盖：间接（blade-runtime.test 通过 tick 进入 cooldown 验证）

### BladeAttackCooldownStarted

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/blade-runtime.js`（`tick`）
- 触发条件：BladeRuntime 动作结束后进入冷却，cooldownLeft > 0。
- data 字段：
  - `bladeId: string`
  - `frames: number`
- 日志格式：`BladeAttackCooldownStarted blade=X Nf`
- 相关机制：Blade Runtime / Cooldown
- 测试覆盖：`tests/blade-runtime.test.mjs`

### BladeAttackCooldownFinished

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/blade-runtime.js`（`tick`）
- 触发条件：BladeRuntime cooldownLeft 递减到 0。
- data 字段：
  - `bladeId: string`
- 日志格式：`BladeAttackCooldownFinished blade=X`
- 相关机制：Blade Runtime / Cooldown
- 测试覆盖：`tests/blade-runtime.test.mjs`

### BladeSpeciesResolved

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/loadout-resolver.js`（`resolveLoadout`）
- 触发条件：解析一个 Beast Blade（有 species/lineage/rarity 字段）时。
- data 字段：
  - `bladeId: string`
  - `species: string`
  - `lineage: string`
  - `rarity: string`
  - `individualTrait: string`
- 日志格式：`BladeSpeciesResolved blade=X species=Y lineage=Z rarity=W trait=V`
- 相关机制：Beast Blade Archetype / LoadoutResolver
- 测试覆盖：`tests/beast-blade-archetype.test.mjs`

### BladeTraitActivated

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/blade-runtime.js`（`tick`）
- 触发条件：BladeRuntime 首次命中且 individualTrait='Fierce' 时。
- data 字段：
  - `bladeId: string`
  - `trait: string`
  - `effect: string`
- 日志格式：`BladeTraitActivated blade=X trait=Y effect=Z`
- 相关机制：Beast Blade Archetype / IndividualTrait / BladeRuntime
- 测试覆盖：`tests/beast-blade-runtime.test.mjs`

## V5.4 Bond Events

### BondTrustChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/bond.js`（BondState 方法，由 BladeRuntime/CombatActor 触发）
- 触发条件：异刃命中（BladeAttackHit）后增加 Trust，或 Victory 后增加 Trust 时。
- data 字段：
  - `bladeId: string`
  - `before: number`
  - `after: number`
  - `beforeLevel: number`
  - `afterLevel: number`
- 日志格式：`BondTrustChanged blade=X N->N LvN->LvN`
- 相关机制：Bond（V5.4）
- 测试覆盖：`tests/bond-runtime.test.mjs`、`tests/bond-scenario.test.mjs`

### BondMoodChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/bond.js`（BondState 方法，由 CombatActor 触发）
- 触发条件：Victory 后增加 Mood，或 Defeat 后降低 Mood 时。
- data 字段：
  - `bladeId: string`
  - `before: number`
  - `after: number`
  - `reason: string`
- 日志格式：`BondMoodChanged blade=X N->N reason=X`
- 相关机制：Bond（V5.4）
- 测试覆盖：`tests/bond-runtime.test.mjs`、`tests/bond-scenario.test.mjs`

### BondSyncChanged

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/bond.js`（BondState 方法，由 BladeRuntime 触发）
- 触发条件：异刃命中（BladeAttackHit）增加 Sync，或 BondSyncTriggered 后重置 Sync 时。
- data 字段：
  - `bladeId: string`
  - `before: number`
  - `after: number`
  - `reason: string`
- 日志格式：`BondSyncChanged blade=X N->N reason=X`
- 相关机制：Bond（V5.4）
- 测试覆盖：`tests/bond-runtime.test.mjs`、`tests/bond-scenario.test.mjs`

### BondSyncTriggered

- 定义位置：`src/core/enums.js`
- 发出位置：`src/core/bond.js`（BondState 方法，由 BladeRuntime 触发）
- 触发条件：Sync 累积达到阈值（默认 75）时触发，并重置 Sync 到 0。
- data 字段：
  - `bladeId: string`
  - `syncThreshold: number`
  - `overflow: number`
- 日志格式：`BondSyncTriggered blade=X threshold=N overflow=N`
- 相关机制：Bond（V5.4）
- 测试覆盖：`tests/bond-runtime.test.mjs`、`tests/bond-scenario.test.mjs`
- 备注：V5.4 MVP 中 Sync 达阈值后清零（sync=0）；overflow 仅作为事件数据记录，不保留到 bond.sync。后续版本可能改为保留溢出值。

### TraitPayoffActivated

- 定义位置：`src/core/enums.js`（V5.5.2 新增）
- 发出位置：`src/core/blade-runtime.js`（FierceFollowUp / ProudSyncStrike）和 `src/core/combat-actor.js`（LoyalGuard）
- 触发条件：Blade 拥有 BondCombatSlot1 且 individualTrait 匹配如下之一：
  - Fierce + BladeAttackHit → `payoffId=FierceFollowUp`
  - Loyal + EnemyAttackHit → `payoffId=LoyalGuard`
  - Proud + BondSyncTriggered → `payoffId=ProudSyncStrike`
- data 字段：
  - `bladeId: string`
  - `trait: 'Fierce' | 'Loyal' | 'Proud'`
  - `payoffId: 'FierceFollowUp' | 'LoyalGuard' | 'ProudSyncStrike'`
  - 对于 FierceFollowUp / ProudSyncStrike：`amount: number`
  - 对于 LoyalGuard：`beforeAmount: number` / `afterAmount: number` / `reducedAmount: number`
- 日志格式：
  - `TraitPayoffActivated trait=Fierce payoff=FierceFollowUp amount=N`
  - `TraitPayoffActivated trait=Loyal payoff=LoyalGuard N->M`
  - `TraitPayoffActivated trait=Proud payoff=ProudSyncStrike amount=N`
- 相关机制：Trait Combat Payoff（V5.5.2）、Combat Unlocks（V5.5.1）、Bond（V5.4）
- 测试覆盖：`tests/trait-combat-payoff.test.mjs`、`tests/trait-combat-payoff-scenario.test.mjs`
- 备注：V5.5.2 中所有 trait payoff 仅在有 BondCombatSlot1 时触发；无槽位时保持 V5.5.1 之前行为不变。

## 事件总览更新

截至 V5.5.2，`CombatEventType` 共 92 个事件值。V5.1 新增 11 个 Blade/Backpack 事件；V5.3 新增 2 个 Beast Blade 事件；V5.4 新增 4 个 Bond 事件；V5.5.2 新增 1 个 TraitPayoffActivated 事件。

