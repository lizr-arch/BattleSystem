# V4.2 Test Coverage Map

本文档盘点 `tests/*.mjs` 的覆盖范围，用于回答：

- 当前哪些机制已有确定性测试证据？
- 哪些事件被断言过？
- 后续扩展（非本仓库范围）时哪些测试必须保持通过（保护性不变量）？

## Deferred (V4.x, planned only)

V4.0 已落地 Single Driver Routine-Orb MVP；Chain Attack / Full Burst / Fusion 等 payoff 机制仍延后，进入实现前必须先完成 `docs/v4-readiness-review.md` 的拆分评审与计划。

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
  - 这是“机制链路验收”模板；V3 已补齐 Blade Combo 同级 scenarios，后续扩展需保持两套场景不退化。

## tests/special-gauge.test.mjs

- 测试目标：验证 SpecialGaugeState 的阈值、readyLevel、充能与消费规则是确定的。
- 覆盖机制：Special Gauge
- 覆盖事件：无（纯 state 测试）
- 关键断言：
  - `addCharge` 的 before/after 与 becameReady 语义正确（跨过 100/200/300 时触发）。
  - `tryConsumeLevel` 在不足 charge/readyLevel 时失败，在足够时成功并扣减 cost。
- 没覆盖的风险：
  - 不覆盖“由 Art 命中触发充能事件”的 emit 链路（由 special-actor.test 覆盖）。
- 必须保持通过的原因：
  - Special 的所有行为都依赖该资源条的确定性。

## tests/special-actor.test.mjs

- 测试目标：验证 SpecialGauge 在 actor 内的挂载点、事件产出，以及 castSpecial 的失败/成功/命中链路。
- 覆盖机制：
  - Special Gauge（通过 Art 命中充能）
  - Special Cast（消费/失败原因/命中事件）
  - Event Log（通过 findEvent 断言）
- 覆盖事件（显式断言）：
  - `SpecialChargeChanged`
  - `SpecialBecameReady`
  - `SpecialCastFailed`
  - `SpecialConsumed`
  - `SpecialHit`
- 关键断言（保护性不变量）：
  - Art 命中会累积 special charge，并在跨阈值时产生 ready 事件。
  - 不足等级 castSpecial 必须失败且不改变 state。
  - 成功 castSpecial 必须消费 charge，并在命中帧产出 SpecialHit。
- 没覆盖的风险：
  - 不覆盖 Blade Combo 路线推进（由 blade-combo* 覆盖）。
- 必须保持通过的原因：
  - V3 的 Special/Blade 入口依赖该链路的确定性与可审计性。

## tests/blade-combo.test.mjs

- 测试目标：验证 BladeComboState 的 start/advance/finish/fail/expire 规则不变量。
- 覆盖机制：Blade Combo
- 覆盖事件：无（直接检查返回事件对象与状态）
- 关键断言：
  - 未命中路线时 `no_route`。
  - 匹配第一步会 Started，推进会 Advanced，最后一步会 Finished 并清空状态。
  - 错元素/等级不足会 Failed 且不推进。
  - tick 归零会 Expired 且回到 None。
- 必须保持通过的原因：
  - route 状态机是 token 产出的前置条件，必须可解释可复现。

## tests/blade-combo-scenario.test.mjs

- 测试目标：跑内置 Blade Combo scenarios，验证 runner + Special + Blade + Token 的端到端链路（纯逻辑、确定性）。
- 覆盖机制：
  - Scenario Runner（steps + prepare）
  - Special（Grant Special / castSpecial / hit）
  - Blade Combo（Started/Advanced/Failed/Expired/Finished）
  - Tokens（TokenCreated + snapshot tokens）
  - Driver Combo（coexist 场景中与 Blade 并行）
- 覆盖事件（显式断言）：
  - `BladeComboStarted`
  - `BladeComboAdvanced`
  - `BladeComboFailed`
  - `BladeComboExpired`
  - `BladeComboFinished`
  - `TokenCreated`
- 关键断言（保护性不变量）：
  - full-blade-combo：完成示例路线后 stage None 且 tokens 长度为 1。
  - wrong-element / insufficient-level：失败原因可审计，且 stage 不推进。
  - expire-blade-combo：倒计时归零过期回 None。
  - driver-and-blade-coexist：Driver Combo 与 Blade Combo 并行存在且互不覆盖。
- 必须保持通过的原因：
  - 这是 V3 的“机制链路验收”证据，防止未来改动破坏 token 产出链路。

## tests/full-battle-loop-scenario.test.mjs

- 测试目标：跑内置 `full-battle-loop` scenario，验证 Driver Combo + Special/Blade/Token 的整条闭环能稳定 PASS。
- 覆盖机制：
  - Scenario Runner
  - Driver Combo（完成）
  - Special/Blade Combo（完成）
  - Tokens（TokenCreated）
- 覆盖事件（显式断言）：
  - proof 中包含 `DriverComboFinished`
  - proof 中包含 `BladeComboFinished`
  - proof 中包含 `TokenCreated FireToken`
- 关键断言（保护性不变量）：
  - 最终 `driverCombo.stage=None` 且 `bladeCombo.stage=None`
  - 最终 tokens 包含 `FireToken`
- 必须保持通过的原因：
  - 这是 V1~V3 主闭环的端到端稳定性证据（未来机制不应破坏该链路）。

## tests/routine-orb.test.mjs

- 测试目标：验证 Routine Orb（套路球）与 Burn（灼烧）基础行为：破球扣血、DoT tick 可击杀、战斗结束事件存在。
- 覆盖机制：
  - Battle / HP / Result
  - Routine Tiles / Routine Orb / Orb Break
  - Debuffs（Burn）
- 覆盖事件（显式断言）：
  - `TargetDefeated`
  - `BattleEnded`（result=Victory）
- 关键断言（保护性不变量）：
  - 破球与 tick 扣血都必须走统一扣血通路（由事件与最终 hp/胜负间接证明）。
- 必须保持通过的原因：
  - 这是 V4.0 单驾驶员 MVP 的核心击杀闭环证据。

## tests/routine-orb-scenario.test.mjs

- 测试目标：跑内置 routine-orb 相关 scenarios，验证 tiles/orb/break/burn-kill/without-orb 的确定性 proof 与最终 snapshot。
- 覆盖机制：
  - Scenario Runner
  - Routine Tiles（Added/Removed）
  - Routine Orb（Created）
  - Orb Break（Failed/Started/Broken/Finished）
  - Debuffs（Applied/TickDamage）
  - Battle / HP / Result（击杀与 BattleEnded）
- 覆盖事件（显式断言）：
  - `RoutineTileAdded`
  - `RoutineOrbCreated`
  - `RoutineOrbBreakFailed`（no_orb）
  - `RoutineOrbBroken`
  - `DebuffApplied`
  - `DebuffTickDamage`
  - `TargetDefeated`
  - `BattleEnded`（Victory）
- 关键断言（保护性不变量）：
  - whiff 不加 tile（通过场景准备关闭 effect，保证命中链路可解释）。
  - 破球后必须清空 `routineOrb/routineTiles`，并保留 Burn。
- 必须保持通过的原因：
  - 这是 V4.0 机制链路验收模板，保证 MVP 可审计且可复现。

## tests/single-driver-mvp.test.mjs

- 测试目标：跑内置 `single-driver-routine-orb-victory` scenario，验证 “单驾驶员·套路球 MVP” 的完整闭环稳定 PASS。
- 覆盖机制：
  - Battle / HP / Result
  - Routine Tiles / Routine Orb / Orb Break
  - Debuffs（Burn tick 击杀）
- 覆盖事件（显式断言存在）：
  - `BattleStarted`
  - `ActionHit`
  - `DamageApplied`
  - `TargetHpChanged`
  - `RoutineTileAdded`
  - `RoutineOrbCreated`
  - `RoutineOrbBroken`
  - `ElementDamageApplied`
  - `DebuffApplied`
  - `DebuffTickDamage`
  - `TargetDefeated`
  - `BattleEnded`（Victory）
- 关键断言（保护性不变量）：
  - 最终 `battle.result=Victory` 且 `target.dead=true` 且 `routineOrb=null`（orb 不残留）。
- 必须保持通过的原因：
  - 这是 V4.0 交付的“一键可审计验收入口”（Node 侧）。

## tests/enemy-strike-scenario.test.mjs

- 测试目标：跑内置 legacy enemy strike scenarios，验证 “EnemyStrike 造成 Defeat” 与 “DriverCombo 控制门禁（Topple 下不启动攻击）”。
- 覆盖机制：
  - Enemy Attack（EnemyStrike spec + `tickEnemy`）
  - Player Damage / Defeat（`applyDamageToPlayer`）
  - DriverCombo control（Topple/Launch 下不应启动攻击）
- 覆盖事件（通过 scenario proof / snapshot 断言）：
  - `EnemyAttackHit`
  - `PlayerDamageApplied`
  - `PlayerDefeated`
  - `BattleEnded`（Defeat）
- 关键断言（保护性不变量）：
  - EnemyStrike 可通过事件日志证明 hit 发生且会导致 Defeat。
  - Driver Combo 处于 Topple 时不应启动攻击（无 `EnemyAttackStarted` 且 `enemy.currentAction=null`）。

## tests/enemy-attack-scenario.test.mjs

- 测试目标：跑 V4.2 required enemy attack scenarios，验证启动/命中/打空/冷却/被控/Defeat/击杀敌人等关键链路稳定 PASS。
- 覆盖机制：
  - Scenario Runner（proof/trace）
  - Enemy Attack（范围/冷却/相位/命中/打空）
  - Player Damage / Defeat
  - Battle / HP / Result
- 覆盖事件（主要由 scenario steps 的 assertEvent/assertSnapshot 覆盖）：
  - `EnemyAttackStarted`
  - `EnemyAttackPhaseChanged`
  - `EnemyAttackHit`
  - `EnemyAttackWhiffed`
  - `EnemyAttackFinished`
  - `EnemyAttackCooldownStarted`
  - `EnemyAttackCooldownFinished`
  - `EnemyControlled`
  - `PlayerDamageApplied`
  - `PlayerHpChanged`
  - `PlayerDefeated`
  - `TargetDefeated`（player-can-defeat-attacking-enemy）
  - `BattleEnded`（Defeat）
- 关键断言（保护性不变量）：
  - out_of_range 必须 whiff 且不会掉血（无 `PlayerDamageApplied`）。
  - 进入冷却期间不应再次启动攻击，冷却结束后才允许再次启动。
  - Topple 下 enemy.state=Controlled 且不应启动攻击。

## tests/enemy-attack.test.mjs

- 测试目标：以 tick 级断言验证 EnemyAttack 相位顺序、命中/打空分支、冷却门禁与 DriverCombo 中断语义。
- 覆盖机制：
  - Enemy Action Timeline（Startup/Active/Recovery/Finished）
  - Range check（hit vs out_of_range whiff）
  - Cooldown gate
  - DriverCombo control 与中断（Launch/Topple）
- 覆盖事件（显式断言存在）：
  - `EnemyAttackStarted`
  - `EnemyAttackPhaseChanged`（Startup->Active->Recovery->Finished）
  - `EnemyAttackHit`
  - `EnemyAttackWhiffed reason=out_of_range`
  - `EnemyAttackCooldownStarted`
  - `EnemyAttackCooldownFinished`
  - `EnemyControlled`
  - `EnemyStrikeInterrupted reason=driver_combo`
  - `PlayerDamageApplied`
  - `PlayerHpChanged`

## tests/player-defeat.test.mjs

- 测试目标：验证 “PlayerDefeated 与 BattleEnded(Defeat) 同帧发生” 以及 battle ended 后不再产生新事件（战斗冻结）。
- 覆盖机制：
  - Player Damage / Defeat
  - Battle / HP / Result（Defeat）
- 覆盖事件（显式断言存在）：
  - `PlayerDefeated`
  - `BattleEnded result=Defeat`
- 关键断言（保护性不变量）：
  - `PlayerDefeated` 必须先于同帧的 `BattleEnded(Defeat)`（事件顺序可审计）。
  - battle ended 后继续 tick 不应产生新事件。

## tests/player-defeat-polish.test.mjs

- 测试目标：验证 V4.3 Defeat Polish 的所有不变量。
- 覆盖机制：
  - Defeat 后战斗规则停止（无新 EnemyAttack/Action/PlayerDamage 事件）。
  - Defeat 后输入被忽略（无 ActionStarted/InputConsumed）。
  - Reset after Defeat 恢复干净状态（battle/player/target/enemy 全量）。
  - finalSnapshot 保留真实 Defeat 状态（player.hp=0, dead=true, enemy.action=null）。
  - lastEnemyOutcome 在 resetRuntime 后清零。
- 覆盖事件（显式断言存在）：
  - `PlayerDefeated`
  - `BattleEnded result=Defeat`
  - `Reset`
  - `BattleStarted`
- 关键断言（保护性不变量）：
  - Defeat 后 120 帧无 EnemyAttackStarted/EnemyAttackHit/PlayerDamageApplied/ActionStarted。
  - Defeat 后 Art 输入不触发 ActionStarted。
  - resetRuntime 后 battle.active=true, result=null, player/target alive, enemy idle。
  - reset 后 battle 可继续运行（tick 60 帧仍 active）。
  - 3 个新 scenarios 通过 scenario runner。
  - V4.0 Routine-Orb 旧测试不回归。
  - V4.2 Enemy Attack 旧测试不回归。

## tests/backpack-grid.test.mjs

- 测试目标：验证 9×9 背包创建、合法放置、越界、重叠、实例 ID 自动生成、快照 API。
- 覆盖机制：BackpackGrid
- 覆盖事件：无（纯 state 测试）
- 关键断言：
  - 9×9 创建成功。
  - 3×3 Blade (0,0) 合法放置。
  - x+width>9 越界失败。
  - y+height>9 越界失败。
  - x<0 越界失败。
  - 两 Blade 重叠失败。
  - 不重叠放置成功。
  - instanceId 自动生成。
  - getSnapshot 返回正确结构。
  - findItemById 正确定位。

## tests/loadout-resolver.test.mjs

- 测试目标：验证 LoadoutResolver 解析合法/非法背包、socket 解析、元素赋值、上限规则。
- 覆盖机制：Loadout Resolver、Nested Socket、Element Core
- 覆盖事件：BackpackResolved、BackpackInvalid
- 关键断言：
  - 合法背包输出 1 activeBlade、element=Neutral。
  - FireCore 插入 socket 后 element=Fire、damageBonus=0.1。
  - 重叠背包输出 errors + BackpackInvalid。
  - 3 个 Blade 时只激活 2 个。
  - socket 全局坐标计算正确。
  - 空背包输出 0 activeBlades。
  - 越界背包输出 errors。
  - 无 Core 时 element=Neutral、sockets 仍记录。

## tests/blade-runtime.test.mjs

- 测试目标：验证 BladeRuntime 自动攻击时序、命中/打空、冷却机制。
- 覆盖机制：Blade Runtime、Action Timeline、Range Check、Cooldown
- 覆盖事件：BladeAttackStarted、BladeAttackHit、BladeAttackWhiffed、BladeAttackCooldownStarted、BladeAttackCooldownFinished
- 关键断言：
  - 创建后 state=Idle、cooldown=0。
  - 在范围内自动攻击启动。
  - 不在范围内不启动。
  - 冷却期间不启动。
  - Active 帧命中产生 BladeAttackHit + damage（含 damageBonus）。
  - Active 帧打空产生 BladeAttackWhiffed、无 damage。
  - 冷却结束后回到 Idle。

## tests/backpack-blade-scenario.test.mjs

- 测试目标：端到端验证 6 个内置 scenarios：有效放置、拒绝重叠、火焰核心解析、自动攻击命中/打空、最多 2 个激活。
- 覆盖机制：Backpack Grid、Loadout Resolver、Blade Runtime、CombatActor 集成
- 覆盖事件：BackpackResolved、BackpackInvalid、BladeLinked、BladeSocketResolved、BladeAttackStarted、BladeAttackHit、BladeAttackWhiffed、DamageApplied、TargetHpChanged
- 关键断言：
  - BackpackResolved activeBlades=1。
  - 重叠产生 BackpackInvalid。
  - FireCore 产生 BladeSocketResolved element=Fire。
  - BladeLinked + BladeAttackStarted + BladeAttackHit 链路存在。
  - DamageApplied source=Blade 存在。
  - whiff 后无 DamageApplied source=Blade。
  - 3 Blade 时 bladeRuntimes.length === 2。

## V5.3.1 备注（BladeRuntime Constructor Cleanup）

V5.3.1 为纯结构性重构：将 `BladeRuntime` 构造函数的 11 个扁平参数收敛为单个 `resolvedBlade` 对象。不改变测试覆盖矩阵的覆盖范围。

影响的测试文件（仅适配新构造函数签名，断言逻辑不变）：
- `tests/blade-runtime.test.mjs`
- `tests/beast-blade-runtime.test.mjs`

其余 blade 相关测试（`backpack-blade-scenario.test.mjs`、`beast-blade-archetype.test.mjs`）通过 LoadoutResolver/ScenarioRunner 间接使用 BladeRuntime，无需修改即可通过。

## V5.4 Bond 测试

### tests/bond-state.test.mjs

- 测试目标：验证 BondState 创建、初始化、clamping、apply 函数、Trait 影响、BondConfig 配置。
- 覆盖机制：Bond（V5.4）
- 覆盖事件：间接（通过 BondState 方法返回事件数据，由外部 emit）
- 测试数量：16
- 关键断言：
  - BondState.create() 初始化 trust=0/mood=50/sync=0/trustLevel=1。
  - addTrust/clampTrust 不超过 0-999。
  - addMood/clampMood 不超过 0-100。
  - addSync/clampSync 不超过 0-100。
  - trustLevel 按阈值计算（0/100/250/500/900 → Lv1-5）。
  - Loyal trait 提供 1.5x trust 增益。
  - Proud trait 提供 1.5x sync 增益 + 0.7x trust 增益。
  - applyBladeHit、applyVictory、applyDefeat 正确。

### tests/bond-runtime.test.mjs

- 测试目标：验证 BladeRuntime 中 Bond 集成，hit 事件关联 bond 变化，trait 效果，_participated 标记。
- 覆盖机制：Bond + BladeRuntime（V5.4）
- 覆盖事件：BondTrustChanged、BondSyncChanged、BondSyncTriggered
- 测试数量：10
- 关键断言：
  - BladeAttackHit 触发 BondTrustChanged 和 BondSyncChanged。
  - Sync 累积到 >= 75 触发 BondSyncTriggered + sync 重置到 0。
  - Loyal trait → bond addTrust 使用 1.5x 倍数。
  - Proud trait → bond addSync 使用 1.5x 倍数、addTrust 使用 0.7x。
  - BladeRuntime._participated 在首次命中后被设为 true。

### tests/bond-scenario.test.mjs

- 测试目标：端到端验证 6 个内置 scenarios：hit sync/trigger/victory/defeat/Loyal/Proud。
- 覆盖机制：Bond + CombatActor 集成（V5.4）
- 覆盖事件：BondTrustChanged、BondMoodChanged、BondSyncChanged、BondSyncTriggered
- 测试数量：6 scenarios
- 关键断言：
  - bond-blade-hit-gains-sync：命中后 BondSyncChanged 存在。
  - bond-sync-triggered：多次命中后 BondSyncTriggered 存在。
  - bond-victory-gains-trust：Victory 后 Trust + Mood 增加。
  - bond-defeat-lowers-mood：Defeat 后 Mood 降低但 Trust 不变。
  - bond-loyal-trait：Loyal Blade Trust 增长更快。
  - bond-proud-trait：Proud Blade Sync 增长更快但 Trust 增长更慢。

## V5.4.1 Bond Persistence 测试

### tests/bond-persistence.test.mjs

- 测试目标：验证 Bond 三维度在 resetRuntime 时的生命周期语义。
- 覆盖机制：Bond（V5.4.1）
- 覆盖事件：BondTrustChanged、BondMoodChanged、BondSyncChanged、BattleEnded（间接）
- 测试数量：9（6 个直接测试 + 3 个新场景 runner 测试）
- 关键断言：
  - Trust survives resetRuntime：BladeAttackHit 后 resetRuntime，新 BladeRuntime 保留原有 Trust。
  - Sync clears on resetRuntime：accumulated sync > 0，resetRuntime 后 sync === 0。
  - Mood resets to 50 on resetRuntime：mood !== 50 时 resetRuntime，mood 回到 50。
  - Victory commit preserves Trust：Victory 后 activeBlade.bond.trust > 0 且与 runtime trust 同步。
  - Defeat lowers Mood but NOT Trust：Defeat 仅降低 Mood，Trust 不受影响；resetRuntime 后 mood 回 50。
  - V5.4 6 个 bond scenarios 不回归。
  - 3 个新 scenarios（bond-reset-keeps-trust、bond-reset-clears-sync、bond-reset-normalizes-mood）通过 scenario runner。

