# V4.0 Mechanics Map

本文档列出 BattleSystem 当前机制地图（Mechanic Inventory）。机制本身以代码与测试为准；本文档提供“机制→文件→输入/输出/事件/不变量/测试”的可追溯索引。
V4.0 在保持 V1~V3 既有闭环可运行的前提下，引入 “Single Driver Routine-Orb MVP（单驾驶员·套路球最小闭环）” 相关机制，并要求文档与 README/验证计划/测试覆盖图口径一致。

## Deferred (V4.3 (completed; V4.x+ future))

- 未来可能评审的 payoff 机制：Chain Attack（连锁攻击）/ Full Burst / Fusion / 更完整的 Orbs cash-out（不在 V4.0 实现范围）。
- 进入实现前必须先完成 Readiness Review 与拆分计划：`docs/v4-readiness-review.md`。

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
- 未来扩展点：如要把 Special 也做成“输入意图”，可新增 `specialPressed` 字段；当前实现选择由 Debug 面板/工具直接调用 `actor.castSpecial(...)`，避免键盘焦点与 one-shot 误差。
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
- 未来扩展点：若未来把 Special 也做成输入（而不是直接 API 调用），再考虑扩展为“多类指令缓冲”；在引入前应先用 scenarios 覆盖确定性行为。
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
- 未来扩展点：如需调整节奏，可把 Special Gauge 的充能入口扩展到普攻命中；当前实现选择只由 Arts 命中充能，避免与普攻资源生产耦合过早。
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
- 未来扩展点：Special Gauge 复用同类结构（addCharge + becameReady + 事件），保持资源条行为可审计。
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
- 未来扩展点：如要引入“节奏奖励”，可在 `CancelBonusApplied` 后追加可配置充能；当前实现未引入额外加成，避免概念混淆。
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
- 未来扩展点：Blade Combo 与 Driver Combo 并行存在（各自独立状态机 + 事件 + snapshot 字段），避免“互相读取条件”导致耦合。
- 不应该做的事：把路线规则写进 UI；或让 Blade Combo 覆盖/替代 Driver Combo。

## Special Gauge

- 目的：提供可充能、可 ready、可消费的资源条，用于驱动 Specials。
- 所属层：`src/core`
- 主要文件：`src/core/special-gauge.js`、`src/core/combat-actor.js`
- 输入：Art 命中时的 `art.specialChargeGain`（当前实现）；以及 debug 注入（Grant Special）。
- 输出：`charge/readyLevel/ratio`（进入 snapshot）；消费结果（ok/failed reason）。
- 拥有状态：`CombatActor.specialGauge`（`SpecialGaugeState`）
- 发出事件：`SpecialChargeChanged`、`SpecialBecameReady`、`SpecialConsumed`、`SpecialCastFailed`、`DebugGrantSpecialReady`
- 消费事件：无（Special 释放通过 `castSpecial` API 触发）
- 关键不变量：
  - 充能只发生在命中结算路径；whiff 不充能。
  - 消费必须检查等级/charge，失败必须产出可审计事件（包含 reason）。
- 测试覆盖：`tests/special-gauge.test.mjs`、`tests/special-actor.test.mjs`
- 不应该做的事：在 UI 中写“是否能放 Special”的规则判断。

## Special Cast

- 目的：把 Special 作为一种复用动作时间轴的“动作类型”，并提供可验证的释放入口。
- 所属层：`src/core`
- 主要文件：`src/core/special.js`、`src/core/combat-actor.js`
- 输入：`actor.castSpecial(specialId)`（当前由 Debug 面板按钮与 scenarios 使用）
- 输出：进入动作时序（ActionStarted/PhaseChanged/Hit/Finished），以及 `SpecialHit` 事件作为 Blade Combo 输入。
- 发出事件：`SpecialConsumed`、`SpecialCastFailed`、`SpecialHit`（以及常规 Action* 事件）
- 测试覆盖：`tests/special-actor.test.mjs`
- 不应该做的事：把 Special “当成 Art 输入缓冲的一部分”硬塞进 `CombatInputFrame`，除非先补齐 scenarios 与边界规则。

## Blade Combo

- 目的：验证一条元素路线链（route），由 Special 命中推进，支持失败与超时分支，并在完成时产出 Token。
- 所属层：`src/core`
- 主要文件：`src/core/blade-combo.js`、`src/core/combat-actor.js`
- 输入：Special 命中时的 `{ element, level }`；每帧 tick 衰减倒计时。
- 输出：`bladeCombo.stage/framesLeft/routeId/expectedNext...`（进入 snapshot）；事件（Started/Advanced/Failed/Expired/Finished）。
- 拥有状态：`CombatActor.bladeCombo`（`BladeComboState`）
- 发出事件：`BladeComboStarted`、`BladeComboAdvanced`、`BladeComboFailed`、`BladeComboExpired`、`BladeComboFinished`
- 关键不变量：
  - 仅在 Special 命中时 apply；whiff 不推进（可由事件日志观察）。
  - 错元素/等级不足只产出 Failed，不推进阶段；倒计时归零产出 Expired 并回 None。
- 测试覆盖：`tests/blade-combo.test.mjs`、`tests/blade-combo-scenario.test.mjs`
- 不应该做的事：让 Blade Combo 读取 Driver Combo stage 作为推进条件（两条链保持并行）。

## Tokens

- 目的：把“路线完成的产物”显式建模为可观察状态，供未来（非本仓库范围）兑现机制使用。
- 所属层：`src/core`
- 主要文件：`src/core/token.js`、`src/core/combat-actor.js`
- 输入：Blade Combo 完成时创建 token spec
- 输出：`tokens[]`（进入 snapshot）；`TokenCreated` 事件
- 关键不变量：
  - token 只由 core 创建并持有；UI 不应直接增删 tokens。
  - 本仓库在 <= V4.2 只验证“产出与可观察性”；cash-out/Chain Attack 等 payoff 机制需等待 V4 Readiness Review 与拆分评审（见 `docs/v4-readiness-review.md`）。
- 测试覆盖：`tests/blade-combo-scenario.test.mjs`（TokenCreated 与 snapshot tokens）

## Battle / HP / Result(V4.3 updated)

- 目的：为单驾驶员 MVP 提供“可击杀目标 + 战斗结果”的最小地基，并把扣血路径统一到可审计事件中。
- 所属层：`src/core`
- 主要文件：`src/core/combat-actor.js`
- 输入：来自普攻/Art/Special/元素伤害/DoT tick/EnemyStrike 的 damage amount
- 输出：`snapshot.battle/snapshot.target/snapshot.player`；事件（DamageApplied/TargetHpChanged/TargetDefeated/PlayerHpChanged/PlayerDefeated/BattleEnded）
- 拥有状态：`CombatActor.battle`、`CombatActor.target`、`CombatActor.player`
- 发出事件：
  - `BattleStarted`（resetRuntime 后）
  - `DamageApplied`
  - `TargetHpChanged`
  - `TargetDefeated`
  - `PlayerHpChanged`
  - `PlayerDefeated`
  - `BattleEnded`
- 关键不变量：
  - 所有扣血必须走统一通路并产出 `DamageApplied`，避免“偷偷改 hp”。
  - hp 归零必须触发 Defeated + BattleEnded（Victory/Defeat）（可由 event log 证明）。
- 测试覆盖：`tests/routine-orb.test.mjs`、`tests/single-driver-mvp.test.mjs`、`tests/enemy-attack.test.mjs`、`tests/enemy-attack-scenario.test.mjs`、`tests/enemy-strike-scenario.test.mjs`

## Enemy Attack（EnemyStrike，V4.2）

- 目的：为敌方提供最小“主动攻击”闭环（启动/时序/命中/空挥/冷却），并把控制权交给 Driver Combo（被控时不攻击）。
- 所属层：`src/core`
- 主要文件：`src/core/enemy-strike.js`、`src/core/combat-actor.js`
- 输入：每帧 tick；距离判定（player<->target）；Driver Combo stage
- 输出：`snapshot.enemy`；事件（EnemyTargetSelected/EnemyAttackStarted/EnemyAttackPhaseChanged/EnemyAttackHit/EnemyAttackWhiffed/EnemyAttackFinished/EnemyAttackCooldownStarted/EnemyAttackCooldownFinished/EnemyControlled/EnemyStrikeInterrupted）
- 拥有状态：`CombatActor.enemy`（cooldownLeft/action/strikeSpec）
- 关键不变量：
  - EnemyStrike 只在 battle active、目标未 dead、玩家未 dead 时运行。
  - 被 Driver Combo 控制时，不应启动 EnemyStrike；若正在执行则中断并进入冷却（可由事件日志证明）。
- 测试覆盖：`tests/enemy-attack.test.mjs`、`tests/enemy-attack-scenario.test.mjs`、`tests/enemy-strike-scenario.test.mjs`

## Routine / Skill Trait（V4.0）

- 目的：引入 “Routine（套路）” 与 “Routine Skill（套路技能）” 的最小识别模型，用于驱动 tiles/orb 生成；并预留 trait（SkillTrait）接口供未来扩展。
- 所属层：`src/core`
- 主要文件：`src/core/routine.js`、`src/core/skill-trait.js`
- 输入：ArtId（当前用 Art1/2/3 映射）
- 输出：`{ routineId, skillId, layer, traits[] }`（当前 traits 不参与结算）
- 关键不变量：
  - 映射是纯函数；命中才触发后续 tiles/orb（whiff 不加）。
  - 当前 MVP 不把 traits 参与伤害/DoT 结算，避免范围膨胀。
- 测试覆盖：通过 scenarios/tests 的端到端链路间接覆盖（tile/orb 依赖该映射）

## Routine Tiles（套路牌，V4.0）

- 目的：把“套路技能命中记录”显式化为最多 3 张 tiles，用于后续 orb 生成条件判断。
- 所属层：`src/core`
- 主要文件：`src/core/routine-orb.js`、`src/core/combat-actor.js`
- 输入：Routine Skill 命中（当前由 `onArtHit` 在命中结算后触发）
- 输出：`snapshot.routineTiles[]`；事件（Added/Removed）
- 拥有状态：`CombatActor.routineTiles`
- 发出事件：`RoutineTileAdded`、`RoutineTileRemoved`
- 关键不变量：
  - tiles 上限为 3；超出必须移除最旧 tile 且产出 `RoutineTileRemoved`。
  - whiff 不产出 tile（以 `ActionWhiffed` 与缺少 tile 事件可证明）。
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`（create/break 场景 proof）

## Routine Orb（套路球，V4.0）

- 目的：在最少规则下验证“3 张同 Routine => 生成 orb”的确定性条件与替换语义。
- 所属层：`src/core`
- 主要文件：`src/core/routine-orb.js`、`src/core/combat-actor.js`
- 输入：`routineTiles`（最近 3 张）
- 输出：`snapshot.routineOrb`；事件（Created/Replaced）
- 拥有状态：`CombatActor.routineOrb`
- 发出事件：`RoutineOrbCreated`、`RoutineOrbReplaced`
- 关键不变量：
  - 仅当 tiles 长度为 3 且 routineId 全相同才创建。
  - 同时只允许 1 个 active orb；重复创建走替换事件而不是 silent overwrite。
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`（routine-orb-create proof）

## Orb Break（破球，V4.0）

- 目的：提供一个显式 API 触发 orb 结算，产出“元素伤害 + Debuff”的可审计链路，并清空 orb/tiles。
- 所属层：`src/core`
- 主要文件：`src/core/combat-actor.js`
- 输入：`actor.breakRoutineOrb()`
- 输出：事件（BreakStarted/Broken/BreakFinished + ElementDamageApplied + DebuffApplied）；状态清空（routineOrb/routineTiles）
- 发出事件：
  - `RoutineOrbBreakFailed`（无 orb）
  - `RoutineOrbBreakStarted`
  - `ElementDamageApplied`
  - `DebuffApplied`
  - `RoutineOrbBroken`
  - `RoutineOrbBreakFinished`
- 关键不变量：
  - 无 orb 必须失败且给出原因（reason=no_orb），不能 silent no-op。
  - 破球结算后必须清空 orb 与 tiles（可由 snapshot 断言）。
- 测试覆盖：`tests/routine-orb-scenario.test.mjs`、`tests/routine-orb.test.mjs`

## Debuffs（灼烧 Burn，V4.0）

- 目的：用最小 DoT 模型验证“持续 tick 扣血可击杀”的战斗闭环。
- 所属层：`src/core`
- 主要文件：`src/core/debuff.js`、`src/core/combat-actor.js`
- 输入：DebuffApplied（当前仅来自破球）
- 输出：每次 tick 产出 `DebuffTickDamage` 并通过 `DamageApplied` 扣血；到期产出 `DebuffExpired`
- 发出事件：`DebuffApplied`、`DebuffTickDamage`、`DebuffExpired`
- 关键不变量：
  - tick 必须可观察（事件 + 扣血通路），且 tick 可以导致击杀与 BattleEnded。
- 测试覆盖：`tests/routine-orb.test.mjs`、`tests/routine-orb-scenario.test.mjs`（burn-kill proof）

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
- 输出：包含 frame/state/position/ranges/action/arts/cancelBonus/inputBuffer/driverCombo/bladeCombo/specialGauge/tokens/eventLogText/config/vfx/paused 的快照对象
- 拥有状态：无（快照是派生数据）
- 发出事件：无
- 消费事件：无
- 关键不变量：
  - UI 只读 snapshot；不应读取 actor 内部字段实现规则。
  - 快照字段应足以支撑验证（trace/proof/UI）与后续机制可视化。
- 测试覆盖：`tests/scenario-runner.test.mjs`（assertSnapshot 使用）、`tests/driver-combo-scenario.test.mjs`、`tests/blade-combo-scenario.test.mjs`
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

## Bond（羁绊，V5.4）

- 目的：为 Blade 与 Driver 之间建立三维关系系统（Trust/Mood/Sync），通过战斗事件驱动变化，并由个体特质（Loyal/Proud）产生可测影响。
- 所属层：`src/core`
- 主要文件：`src/core/bond.js`、`src/core/blade-runtime.js`、`src/core/combat-actor.js`
- 输入：BladeAttackHit → +Sync +Trust；Victory → +Trust +Mood（参与 blades）；Defeat → -Mood
- 输出：`snapshot.bladeRuntimes[].bond`（trust/trustLevel/mood/sync）；事件（BondTrustChanged/BondMoodChanged/BondSyncChanged/BondSyncTriggered）
- 拥有状态：`BondState { trust, mood, sync }`（挂载在 BladeRuntime）
- 发出事件：`BondTrustChanged`、`BondMoodChanged`、`BondSyncChanged`、`BondSyncTriggered`
- 消费事件：`BladeAttackHit`（驱动 sync/trust 增长）、`BattleEnded`（驱动 victory/defeat bond 变化）
- 关键不变量：
  - Trust 0-999 分 5 级（0/100/250/500/900），只增不减。
  - Mood 0-100，Victory 增加、Defeat 降低。
  - Sync 0-100，命中累积 >= 75 触发 BondSyncTriggered 并重置到 0。
  - Loyal trait：Trust 增益 +50%；Proud trait：Sync 增益 +50% 但 Trust 增益 -30%。
- 测试覆盖：`tests/bond-state.test.mjs`、`tests/bond-runtime.test.mjs`、`tests/bond-scenario.test.mjs`
- 未来扩展点：BondSkillUnlocked/BondSocketUnlocked/BondMilestoneReached/BondAssistActivated（V5.4 明确不做）。
- 不应该做的事：让 Bond 直接决定伤害或战斗规则（应通过行为与触发条件影响，而非纯数值加成）。

## Combat Unlocks（信任解锁，V5.5.1）

- 目的：基于 Bond trustLevel 动态解锁 combatSlot，在不消费 slot 的情况下提供可观察的解锁状态。
- 所属层：`src/core`
- 主要文件：`src/core/combat-unlocks.js`
- 输入：Bond trustLevel
- 输出：`resolvedBlade.unlocks`、`BladeRuntime.getSnapshot().unlocks`
- 拥有状态：无（纯函数，`resolveCombatUnlocks(bond)`）
- 发出事件：无（当前不产生专项事件）
- 消费事件：无
- 关键不变量：
  - trustLevel >= 3 → combatSlots = `['BondCombatSlot1']`。
  - trustLevel < 3 → combatSlots 为空。
  - null bond 视为 trustLevel=0，无解锁。
  - unlock 在 resetRuntime 后保留（基于持久化的 bond trustLevel 重新计算）。
  - unlock 在 Defeat 后保留（trustLevel 不下降）。
- 测试覆盖：`tests/combat-unlocks.test.mjs`、`tests/trust-unlock-scenario.test.mjs`
- 未来扩展点：future trust levels 4/5 可解锁更多 combatSlot（如 `BondCombatSlot2`/`BondCombatSlot3`）；当前只定义 Lv3 解锁一个槽位，避免范围膨胀。
- 不应该做的事：让 UI 直接计算 unlock 条件；或让 unlock 自动改变伤害/行为（当前仅作为状态标记，不消费）。

## Trait Combat Payoff（特质战斗兑现，V5.5.2）

- 目的：让拥有 BondCombatSlot1（trustLevel >= 3）的 Blade 根据 individualTrait 在战斗中产生确定性、可观察的 payoff 效果。
- 所属层：`src/core`
- 主要文件：`src/core/trait-combat-payoff.js`
- 输入：BladeRuntime 的 individualTrait + unlocks（or resolvedBlade.unlocks）+ 触发上下文（blade_hit / sync_triggered / incomingDamage）
- 输出：结构化 payoff 结果（payoffId + damage），或 LoyalGuard 减免后伤害
- 拥有状态：无（纯函数）
- 发出事件：`TraitPayoffActivated`
- 消费事件：由 BladeRuntime.tick() 与 CombatActor.applyDamageToPlayer() 消费 trait-combat-payoff 函数结果
- 关键不变量：
  - 所有 trait payoff 必须有 BondCombatSlot1。
  - FierceFollowUp = bladeHitDamage × 0.15。
  - LoyalGuard = incomingDamage × 0.85（只影响 enemy source）。
  - ProudSyncStrike = bladeHitDamage × 0.10（仅在 BondSyncTriggered 时）。
  - 多个 Loyal Blade 只应用一次减伤。
  - payoff 伤害通过 applyDamageToTarget 统一通路。
  - 确定性，不用概率。
- 测试覆盖：`tests/trait-combat-payoff.test.mjs`、`tests/trait-combat-payoff-scenario.test.mjs`
- 未来扩展点：未来 trust level 4/5 解锁更多 combat slot 后，可扩展 payoff 效果（如 Fierce 双倍追击、Loyal 护主+反伤等）。
- 不应该做的事：引入概率触发、引入新战斗资源/按钮、绕过统一 damage 通路。

## Browser Debug UI

- 目的：浏览器可视化验证壳：输入、画布渲染、事件日志面板、调参、Scenario 一键 Run、Debug 输入（Grant Ready/StepToRecovery/Cast）。
- 所属层：`src/ui`
- 主要文件：`src/ui/sandbox-app.js`、`src/ui/debug-panel.js`、`src/ui/browser-input.js`、`src/ui/canvas-renderer.js`
- 输入：浏览器键盘事件、按钮点击、slider 调参、scenario 名称
- 输出：`actor.tick()` 调用、Debug 事件 `DebugGrantArtsReady/DebugGrantSpecialReady`、UI 渲染与 PASS/FAIL proof 输出
- 拥有状态：UI 组件状态（keys/oneShot、DOM refs）
- 发出事件：`DebugGrantArtsReady`、`DebugGrantSpecialReady`（由 debug panel / dev scenarios 直接发出，用于验证准备）
- 消费事件：读取 `actor.getSnapshot()`（含 `eventLogText`）用于渲染
- 关键不变量：
  - UI 不决定战斗规则，只驱动 tick 并展示可观察结果。
  - Scenario 结果必须可解释（proof + trace tail）。
- 测试覆盖：`tests/ui-module-load.test.mjs`
- 未来扩展点：V3 新机制 UI 展示应基于 snapshot 字段与事件，而不是直接访问 core 内部实现。
- 不应该做的事：把 Special/Blade Combo 写死到 UI；或让 UI 特判推进/失败条件。

